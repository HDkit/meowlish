import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth-gateway/auth-cookies';
import { type ExecutionContext } from '@nestjs/common';
import {
	type ThrottlerGetTrackerFunction,
	type ThrottlerModuleOptions,
	normalizeIp,
} from '@nestjs/throttler';
import { readCookie } from '@server/utils';
import { type Request } from 'express';
import jwt from 'jsonwebtoken';

const MINUTE = 60_000;
const STRICT_LIMIT = 10;

/** Health probes (`/health/*`, outside the `/api` prefix) must never be throttled. */
export const isHealthRoute = (context: ExecutionContext): boolean => {
	const req = context.switchToHttp().getRequest<Partial<Request>>();
	return (req.path ?? req.url ?? '').startsWith('/health/');
};

/** Default: 100 requests per minute per IP. */
export const throttlerOptions: ThrottlerModuleOptions = {
	throttlers: [{ ttl: MINUTE, limit: 100 }],
	skipIf: isHealthRoute,
	errorMessage: 'Rate limit reached',
};

type AccountKey = (req: Request) => string | undefined;

/**
 * Tracker `<ip>:<account>`, so pupils behind one classroom NAT each get their own budget while
 * one account is still limited per IP. Falls back to the IP when the request names no account.
 * `@Throttle` replaces the default throttler on these routes, so there is no separate per-IP cap
 * on them: one IP gets 10/min for each account it names.
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

const strict = (accountKey: AccountKey) => ({
	default: { limit: STRICT_LIMIT, ttl: MINUTE, getTracker: accountTracker(accountKey) },
});

/** 10/min per IP and e-mail (`body.mail`): login, register, add mail credential. */
export const strictThrottleByMail = strict(mailOf);

/** 10/min per IP and refresh-token subject: `/auth/refresh`. */
export const strictThrottleByRefreshToken = strict(tokenSubject(REFRESH_TOKEN_COOKIE));

/** 10/min per IP and access-token subject: password change and other signed-in strict routes. */
export const strictThrottleBySession = strict(tokenSubject(ACCESS_TOKEN_COOKIE));
