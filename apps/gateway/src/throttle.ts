import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth-gateway/auth-cookies';
import { type ExecutionContext, SetMetadata, applyDecorators } from '@nestjs/common';
import {
	SkipThrottle,
	Throttle,
	type ThrottlerGetTrackerFunction,
	type ThrottlerModuleOptions,
	type ThrottlerOptions,
	normalizeIp,
} from '@nestjs/throttler';
import { readCookie } from '@server/utils';
import { type Request } from 'express';
import jwt from 'jsonwebtoken';

const MINUTE = 60_000;
const STRICT_LIMIT = 10;
const IP_LIMIT = 100;
const ANSWER_LIMIT = 300;

/** Health probes (`/health/*`, outside the `/api` prefix) must never be throttled. */
export const isHealthRoute = (context: ExecutionContext): boolean => {
	const req = context.switchToHttp().getRequest<Partial<Request>>();
	return (req.path ?? req.url ?? '').startsWith('/health/');
};

const STRICT_THROTTLE = 'gateway:strict-throttle';

const isStrictRoute = (context: ExecutionContext): boolean =>
	Reflect.getMetadata(STRICT_THROTTLE, context.getHandler()) === true;

/**
 * Two named throttlers, both keyed by client IP and per route:
 * - `default`: 100/min on every route. Strict routes override it with a per-account 10/min.
 * - `ip`: 100/min, active ONLY on strict routes (which never override it), so one IP naming many
 *   accounts still hits a per-IP ceiling there. Skipped elsewhere: normal routes count once.
 */
const throttlers: ThrottlerOptions[] = [
	// per IP and signed-in account (IP alone when signed out): behind the frontend's proxy every
	// user reaches the gateway from the proxy's address, so a per-IP budget was shared by all users
	{
		name: 'default',
		ttl: MINUTE,
		limit: IP_LIMIT,
		getTracker: (req, context) => defaultTracker(req, context),
	},
	{
		name: 'ip',
		ttl: MINUTE,
		limit: IP_LIMIT,
		// a named throttler's skipIf replaces the common one, so repeat the health check
		skipIf: context => isHealthRoute(context) || !isStrictRoute(context),
	},
];

export const throttlerOptions: ThrottlerModuleOptions = {
	throttlers: throttlers,
	skipIf: isHealthRoute,
	errorMessage: 'Rate limit reached',
};

/** Skips every named throttler (`@SkipThrottle()` alone only skips `default`). */
export const SkipAllThrottlers = () =>
	SkipThrottle(Object.fromEntries(throttlers.map(t => [t.name ?? 'default', true])));

type AccountKey = (req: Request) => string | undefined;

/**
 * Tracker `<ip>:<account>`, so pupils behind one classroom NAT each get their own budget while
 * one account is still limited per IP. Falls back to the IP when the request names no account.
 * This replaces the `default` throttler on strict routes; the `ip` throttler still caps the IP.
 */
const accountTracker =
	(accountKey: AccountKey): ThrottlerGetTrackerFunction =>
	req => {
		const r = req as Request;
		const ip = normalizeIp(r.ip ?? '');
		const account = accountKey(r);
		return account ? `${ip}:${account}` : ip;
	};

const mailOf: AccountKey = req => {
	const mail: unknown = (req.body as { mail?: unknown } | undefined)?.mail;
	return typeof mail === 'string' && mail.trim() ? mail.trim().toLowerCase() : undefined;
};

/**
 * `sub` of the JWT in `cookie`, else in `Authorization: Bearer`. Decoded WITHOUT verifying: it only
 * picks a rate-limit bucket, the auth guards still verify the token. A forged token gets its own
 * bucket but is then refused by the guard.
 */
const tokenSubject =
	(cookie: string): AccountKey =>
	req => {
		const header = req.headers.authorization;
		const token =
			readCookie(req.headers.cookie, cookie) ??
			(header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined);
		if (!token) return undefined;
		const payload = jwt.decode(token);
		const sub: unknown = typeof payload === 'object' ? payload?.sub : undefined;
		return typeof sub === 'string' && sub ? `sub:${sub}` : undefined;
	};

/** Tracker of the `default` throttler: `<ip>:sub:<id>` for signed-in requests, else the IP. */
const defaultTracker: ThrottlerGetTrackerFunction = (req, context) =>
	accountTracker(tokenSubject(ACCESS_TOKEN_COOKIE))(req, context);

/** Per-account 10/min (`default` overridden) plus the per-IP 100/min `ip` throttler. */
const strict = (accountKey: AccountKey) =>
	applyDecorators(
		Throttle({
			default: { limit: STRICT_LIMIT, ttl: MINUTE, getTracker: accountTracker(accountKey) },
		}),
		SetMetadata(STRICT_THROTTLE, true),
	);

/** 10/min per IP and e-mail (`body.mail`), 100/min per IP: login, register. */
export const StrictThrottleByMail = () => strict(mailOf);

/** 10/min per IP and refresh-token subject, 100/min per IP: `/auth/refresh`. */
export const StrictThrottleByRefreshToken = () => strict(tokenSubject(REFRESH_TOKEN_COOKIE));

/**
 * 10/min per IP and access-token subject, 100/min per IP: add mail credential, password change and
 * other signed-in strict routes.
 */
export const StrictThrottleBySession = () => strict(tokenSubject(ACCESS_TOKEN_COOKIE));

/**
 * Answer autosave (save/remove an answer, note, flag): 300/min per IP and signed-in account
 * instead of 100/min per IP, so a fast typist or a classroom behind one NAT can't run out of
 * budget mid-exam and silently lose answers.
 */
export const AnswerThrottle = () =>
	Throttle({
		default: {
			limit: ANSWER_LIMIT,
			ttl: MINUTE,
			getTracker: accountTracker(tokenSubject(ACCESS_TOKEN_COOKIE)),
		},
	});
