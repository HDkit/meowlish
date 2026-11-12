import { readCookie } from '@server/utils';
import { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/** The refresh token is only ever needed by `/auth/refresh` (and cleared by logout). */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

/** passport-jwt extractor reading one cookie straight from the `Cookie` header. */
export const cookieExtractor =
	(name: string) =>
	(req: Request): string | null =>
		readCookie(req.headers.cookie, name) ?? null;

const baseOptions = (req: Request, env: string): CookieOptions => ({
	httpOnly: true,
	sameSite: 'lax',
	secure: req.secure || req.headers['x-forwarded-proto'] === 'https' || env === 'production',
});

/** Milliseconds until the token's own `exp`, so cookie lifetimes always follow the auth service's TTLs. */
const maxAgeMs = (token: string): number | undefined => {
	const exp = (jwt.decode(token) as { exp?: unknown } | null)?.exp;
	if (typeof exp !== 'number') return undefined; // no exp -> session cookie
	return Math.max(0, exp * 1000 - Date.now());
};

export const setAuthCookies = (
	req: Request,
	res: Response,
	tokens: { accessToken: string; refreshToken?: string },
	env: string,
) => {
	const base = baseOptions(req, env);
	res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
		...base,
		path: '/',
		maxAge: maxAgeMs(tokens.accessToken),
	});
	if (tokens.refreshToken) {
		res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
			...base,
			path: REFRESH_TOKEN_COOKIE_PATH,
			maxAge: maxAgeMs(tokens.refreshToken),
		});
	}
};

export const clearAuthCookies = (req: Request, res: Response, env: string) => {
	const base = baseOptions(req, env);
	res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
	res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: REFRESH_TOKEN_COOKIE_PATH });
};
