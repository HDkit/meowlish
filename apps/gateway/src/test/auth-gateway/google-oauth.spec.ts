import { AuthGatewayController } from '../../auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from '../../auth-gateway/constants/auth';
import { GOOGLE_CALLBACK_PATH } from '../../auth-gateway/google-oauth-frontends';
import { GoogleOAuth2Strategy } from '../../auth-gateway/strategies/google-oauth2.strategy';
import { JwtStrategy } from '../../auth-gateway/strategies/jwt.strategy';
import {
	LEGACY_STATE_GRACE_MS,
	OAUTH_STATE_COOKIE,
	oauthStateKey,
} from '../../auth/guards/google-oauth2.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { status } from '@grpc/grpc-js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';
import { type Server as HttpServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { type Observable, of, throwError } from 'rxjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
	modulusLength: 2048,
	publicKeyEncoding: { type: 'spki', format: 'pem' },
	privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const accessToken = jwt.sign(
	{ sub: 'user-1', permissions: [], roles: [], iatMs: Date.now() },
	privateKey,
	{ algorithm: 'RS256', expiresIn: 900 },
);

const MAIN = 'https://main.example.com';
const SHARE = 'https://share.example.com';

/** Redis fake with just the commands the Google flow uses. */
class FakeRedis {
	readonly store = new Map<string, string>();
	get = jest.fn((key: string) => Promise.resolve(this.store.get(key) ?? null));
	set = jest.fn((key: string, value: string) => {
		this.store.set(key, value);
		return Promise.resolve('OK');
	});
	setex = jest.fn((key: string, _ttl: number, value: string) => this.set(key, value));
	del = jest.fn((key: string) => Promise.resolve(this.store.delete(key) ? 1 : 0));
	getdel = jest.fn((key: string) => {
		const value = this.store.get(key) ?? null;
		this.store.delete(key);
		return Promise.resolve(value);
	});
}

type OAuth2Client = {
	getOAuthAccessToken: (
		code: string,
		params: Record<string, string>,
		cb: (err: unknown, at?: string, rt?: string, res?: object) => void,
	) => void;
};

describe('Google OAuth across frontends', () => {
	let app: INestApplication;
	let base: string;
	const redis = new FakeRedis();
	const authService = {
		validateAccess: jest.fn(() => of({})),
		registerOrLoginGoogle: jest.fn(() => of({ accessToken: 'at', refreshToken: 'rt' })),
		addGoogleCredential: jest.fn((): Observable<object> => of({})),
		getCredentials: jest.fn(() => of({ credentials: [{ id: 'c1', type: 'MAIL' }] })),
	};
	/** redirect_uri that passport sent in the code exchange. */
	let exchangedRedirectUri: string | undefined;
	const config: Record<string, unknown> = {
		jwt: { publicKey: publicKey },
		env: 'development',
		corsOrigins: [MAIN, SHARE],
		googleOAuth2: { clientId: 'client-id', secret: 'secret' },
		vps: {
			baseUrl: MAIN,
			feLoginRedirectUrl: `${MAIN}/auth/callback`,
			googleOAuthFrontends: [SHARE],
		},
	};

	const get = (path: string, headers: Record<string, string> = {}) =>
		fetch(`${base}${path}`, { headers: headers, redirect: 'manual' });
	const location = (res: Response) => new URL(res.headers.get('location') ?? '');
	/** A failed callback must redirect to the frontend (never answer JSON). */
	const errorRedirect = (res: Response) => {
		expect(res.status).toBe(302);
		const url = location(res);
		return {
			at: `${url.origin}${url.pathname}`,
			error: url.searchParams.get('error'),
			flow: url.searchParams.get('flow'),
		};
	};
	const putState = (nonce: string, record: object) =>
		redis.store.set(oauthStateKey(nonce), JSON.stringify(record));
	/** A login state as the start writes it now; returns the matching cookie header. */
	const putLogin = (nonce: string, record: object = {}) => {
		putState(nonce, { ...record, bound: true });
		return { Cookie: `${OAUTH_STATE_COOKIE}=${nonce}` };
	};
	const stateCookie = (res: Response) =>
		res.headers.getSetCookie().find(c => c.startsWith(`${OAUTH_STATE_COOKIE}=`));
	/** Runs the rest of a test after the transition window for pre-deploy flows has closed. */
	const afterTransition = async (run: () => Promise<void>) => {
		const closed = Date.now() + LEGACY_STATE_GRACE_MS + 1;
		const now = jest.spyOn(Date, 'now').mockReturnValue(closed);
		try {
			await run();
		} finally {
			now.mockRestore();
		}
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [AuthGatewayController],
			providers: [
				JwtStrategy,
				GoogleOAuth2Strategy,
				{ provide: APP_GUARD, useClass: JwtAuthGuard },
				{ provide: AUTH_CLIENT, useValue: { getService: () => authService } },
				{ provide: ConfigService, useValue: { getOrThrow: (key: string) => config[key] } },
				{ provide: RedisService, useValue: { getOrThrow: () => redis } },
			],
		}).compile();
		// Stand in for Google: the code exchange and the profile fetch.
		const strategy = moduleRef.get<
			GoogleOAuth2Strategy,
			{
				_oauth2: OAuth2Client;
				userProfile: (at: string, done: (err: unknown, profile?: object) => void) => void;
			}
		>(GoogleOAuth2Strategy);
		strategy._oauth2.getOAuthAccessToken = (_code, params, cb) => {
			exchangedRedirectUri = params['redirect_uri'];
			cb(null, 'google-at', 'google-rt', {});
		};
		strategy.userProfile = (_at, done) =>
			done(null, {
				id: 'google-1',
				provider: 'google',
				displayName: 'Nguyễn Văn A',
				emails: [{ value: 'van.a@gmail.com', verified: true }],
			});

		app = moduleRef.createNestApplication();
		await app.listen(0, '127.0.0.1');
		base = `http://127.0.0.1:${((app.getHttpServer() as HttpServer).address() as AddressInfo).port}`;
	});

	beforeEach(() => {
		redis.store.clear();
		jest.clearAllMocks();
		exchangedRedirectUri = undefined;
	});

	afterAll(() => app.close());

	describe('start', () => {
		it('default frontend login: BASE_URL callback and a state bound to the browser', async () => {
			const res = await get('/google');
			expect(res.status).toBe(302);
			const url = location(res);
			expect(url.host).toBe('accounts.google.com');
			expect(url.searchParams.get('redirect_uri')).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			const state = url.searchParams.get('state') ?? '';
			expect(JSON.parse(redis.store.get(oauthStateKey(state)) ?? '')).toEqual({ bound: true });
			const cookie = stateCookie(res);
			expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
			expect(cookie).toContain(`Path=${GOOGLE_CALLBACK_PATH}`);
			expect(cookie).toContain('HttpOnly');
			expect(cookie).toContain('SameSite=Lax');
		});

		it('naming the default frontend is the same as omitting it', async () => {
			const url = location(await get(`/google?frontend=${encodeURIComponent(`${MAIN}/`)}`));
			expect(url.searchParams.get('redirect_uri')).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			const state = url.searchParams.get('state') ?? '';
			expect(JSON.parse(redis.store.get(oauthStateKey(state)) ?? '')).toEqual({ bound: true });
		});

		it('listed frontend: its own callback, remembered in the bound state', async () => {
			const res = await get(`/google?frontend=${encodeURIComponent(SHARE)}`);
			const url = location(res);
			expect(url.searchParams.get('redirect_uri')).toBe(`${SHARE}${GOOGLE_CALLBACK_PATH}`);
			const state = url.searchParams.get('state') ?? '';
			expect(JSON.parse(redis.store.get(oauthStateKey(state)) ?? '')).toEqual({
				frontend: SHARE,
				bound: true,
			});
			expect(stateCookie(res)).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
		});

		it('unlisted frontend is 400, so the redirect cannot leave the allowlist', async () => {
			const res = await get(`/google?frontend=${encodeURIComponent('https://evil.example')}`);
			expect(res.status).toBe(400);
			expect(redis.set).not.toHaveBeenCalled();
		});

		it('linking binds the state to the browser with a cookie', async () => {
			const res = await get(`/credentials/google?frontend=${encodeURIComponent(SHARE)}`, {
				Cookie: `access_token=${accessToken}`,
			});
			expect(res.status).toBe(302);
			const state = location(res).searchParams.get('state') ?? '';
			expect(JSON.parse(redis.store.get(oauthStateKey(state)) ?? '')).toEqual({
				identityId: 'user-1',
				frontend: SHARE,
				bound: true,
			});
			const cookie = stateCookie(res);
			expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
			expect(cookie).toContain(`Path=${GOOGLE_CALLBACK_PATH}`);
			expect(cookie).not.toContain('Secure');
		});

		it('the state cookie is Secure in production, like the session cookies', async () => {
			config['env'] = 'production';
			try {
				const res = await get('/credentials/google', { Cookie: `access_token=${accessToken}` });
				expect(stateCookie(res)).toContain('Secure');
			} finally {
				config['env'] = 'development';
			}
		});
	});

	describe('callback', () => {
		it('default frontend login, with the Google name and email', async () => {
			const res = await get('/google/callback?code=c&state=n0', putLogin('n0'));
			expect(res.status).toBe(302);
			expect(exchangedRedirectUri).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			const url = location(res);
			expect(`${url.origin}${url.pathname}`).toBe(`${MAIN}/auth/callback`);
			expect(url.searchParams.get('loginToken')).toBeTruthy();
			expect(url.searchParams.get('flow')).toBeNull();
			expect(authService.registerOrLoginGoogle).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'google-1',
					fullName: 'Nguyễn Văn A',
					email: 'van.a@gmail.com',
				}),
			);
			expect(redis.store.has(oauthStateKey('n0'))).toBe(false);
			expect(stateCookie(res)).toContain(`${OAUTH_STATE_COOKIE}=;`);
		});

		it("login with someone else's code and state is refused (login CSRF)", async () => {
			putLogin('n8');
			const attempts: Record<string, string>[] = [{}, { Cookie: `${OAUTH_STATE_COOKIE}=attacker` }];
			for (const headers of attempts) {
				const res = await get('/google/callback?code=c&state=n8', headers);
				expect(errorRedirect(res)).toEqual({
					at: `${MAIN}/auth/callback`,
					error: 'SESSION_EXPIRED',
					flow: null,
				});
			}
			expect(redis.store.has(oauthStateKey('n8'))).toBe(true);
			expect(authService.registerOrLoginGoogle).not.toHaveBeenCalled();
		});

		it('transition: a pre-deploy login without a state is still accepted', async () => {
			const res = await get('/google/callback?code=c');
			expect(res.status).toBe(302);
			expect(location(res).searchParams.get('loginToken')).toBeTruthy();
		});

		it('transition: a pre-deploy unbound listed-frontend state needs no cookie', async () => {
			putState('n9', { frontend: SHARE });
			const res = await get('/google/callback?code=c&state=n9');
			expect(res.status).toBe(302);
			expect(location(res).searchParams.get('loginToken')).toBeTruthy();
		});

		it('after the transition a missing or unbound state is refused', async () => {
			await afterTransition(async () => {
				expect(errorRedirect(await get('/google/callback?code=c'))).toEqual({
					at: `${MAIN}/auth/callback`,
					error: 'SESSION_EXPIRED',
					flow: null,
				});
				putState('n10', { frontend: SHARE });
				expect(errorRedirect(await get('/google/callback?code=c&state=n10'))).toMatchObject({
					at: `${SHARE}/auth/callback`,
					error: 'SESSION_EXPIRED',
				});
				// a bound state with its cookie still works
				const res = await get('/google/callback?code=c&state=n11', putLogin('n11'));
				expect(location(res).searchParams.get('loginToken')).toBeTruthy();
			});
			expect(authService.registerOrLoginGoogle).toHaveBeenCalledTimes(1);
		});

		it('login from a listed frontend returns to that frontend', async () => {
			const res = await get(
				'/google/callback?code=c&state=n1',
				putLogin('n1', { frontend: SHARE }),
			);
			expect(res.status).toBe(302);
			// passport must repeat the redirect_uri of the start, or Google rejects the exchange
			expect(exchangedRedirectUri).toBe(`${SHARE}${GOOGLE_CALLBACK_PATH}`);
			const url = location(res);
			expect(`${url.origin}${url.pathname}`).toBe(`${SHARE}/auth/callback`);
			expect(redis.store.has(oauthStateKey('n1'))).toBe(false);
		});

		it('linking with the matching cookie adds the credential', async () => {
			putState('n2', { identityId: 'user-1', frontend: SHARE });
			const res = await get('/google/callback?code=c&state=n2', {
				Cookie: `${OAUTH_STATE_COOKIE}=n2`,
			});
			expect(res.status).toBe(302);
			expect(authService.addGoogleCredential).toHaveBeenCalledWith({
				identifier: 'google-1',
				identityId: 'user-1',
			});
			expect(authService.registerOrLoginGoogle).not.toHaveBeenCalled();
			const url = location(res);
			expect(url.origin).toBe(SHARE);
			expect(url.searchParams.get('flow')).toBe('link');
			expect(url.searchParams.get('loginToken')).toBeTruthy();
			// the spent nonce's cookie is cleared on the callback path
			const cleared = res.headers.getSetCookie().find(c => c.startsWith(`${OAUTH_STATE_COOKIE}=;`));
			expect(cleared).toContain(`Path=${GOOGLE_CALLBACK_PATH}`);
			expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
		});

		it('linking without the cookie is refused and does not burn the state', async () => {
			putState('n3', { identityId: 'user-1', frontend: SHARE });
			const res = await get('/google/callback?code=c&state=n3', {
				Cookie: `${OAUTH_STATE_COOKIE}=other`,
			});
			expect(errorRedirect(res)).toEqual({
				at: `${SHARE}/auth/callback`,
				error: 'SESSION_EXPIRED',
				flow: 'link',
			});
			expect(redis.store.has(oauthStateKey('n3'))).toBe(true);
			expect(authService.addGoogleCredential).not.toHaveBeenCalled();
		});

		it.each([
			['unknown', undefined],
			['pre-JSON (bare identity id)', 'user-1'],
			['for a frontend no longer listed', JSON.stringify({ frontend: 'https://gone.example' })],
		])('%s state goes back to the default frontend with SESSION_EXPIRED', async (_name, raw) => {
			if (raw !== undefined) redis.store.set(oauthStateKey('n4'), raw);
			const res = await get('/google/callback?code=c&state=n4');
			expect(errorRedirect(res)).toEqual({
				at: `${MAIN}/auth/callback`,
				error: 'SESSION_EXPIRED',
				flow: null,
			});
			expect(authService.registerOrLoginGoogle).not.toHaveBeenCalled();
		});

		it('cancelling on Google is ACCESS_DENIED, back on the frontend that started', async () => {
			const res = await get(
				'/google/callback?error=access_denied&state=n5',
				putLogin('n5', { frontend: SHARE }),
			);
			expect(errorRedirect(res)).toEqual({
				at: `${SHARE}/auth/callback`,
				error: 'ACCESS_DENIED',
				flow: null,
			});
		});

		it('linking when the account already has Google is GOOGLE_ALREADY_LINKED', async () => {
			authService.getCredentials.mockReturnValueOnce(
				of({ credentials: [{ id: 'c2', type: 'GOOGLE' }] }),
			);
			putState('n6', { identityId: 'user-1' });
			const res = await get('/google/callback?code=c&state=n6', {
				Cookie: `${OAUTH_STATE_COOKIE}=n6`,
			});
			expect(errorRedirect(res)).toEqual({
				at: `${MAIN}/auth/callback`,
				error: 'GOOGLE_ALREADY_LINKED',
				flow: 'link',
			});
			expect(authService.addGoogleCredential).not.toHaveBeenCalled();
		});

		it("linking another account's Google is GOOGLE_ACCOUNT_IN_USE", async () => {
			authService.addGoogleCredential.mockReturnValueOnce(
				throwError(() => ({ code: status.ALREADY_EXISTS, details: 'linked to another account' })),
			);
			putState('n7', { identityId: 'user-1' });
			const res = await get('/google/callback?code=c&state=n7', {
				Cookie: `${OAUTH_STATE_COOKIE}=n7`,
			});
			expect(errorRedirect(res)).toMatchObject({ error: 'GOOGLE_ACCOUNT_IN_USE', flow: 'link' });
		});

		it('a locked account is FORBIDDEN, an unexpected failure GOOGLE_FAILED', async () => {
			authService.registerOrLoginGoogle.mockReturnValueOnce(
				throwError(() => ({ code: status.PERMISSION_DENIED, details: 'Account locked' })),
			);
			const locked = await get('/google/callback?code=c&state=l1', putLogin('l1'));
			expect(errorRedirect(locked)).toMatchObject({ error: 'FORBIDDEN' });
			authService.registerOrLoginGoogle.mockReturnValueOnce(throwError(() => new Error('boom')));
			const failed = await get('/google/callback?code=c&state=l2', putLogin('l2'));
			expect(errorRedirect(failed)).toMatchObject({
				error: 'GOOGLE_FAILED',
			});
		});
	});

	describe('login token exchange', () => {
		const exchange = (loginToken: string) =>
			fetch(`${base}/google/tokens`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ loginToken: loginToken }),
			});
		const sessionCookies = (res: Response) =>
			res.headers.getSetCookie().filter(c => /^(access|refresh)_token=[^;]/.test(c));

		it('the callback login token sets the session cookies once', async () => {
			const callback = await get('/google/callback?code=c&state=x1', putLogin('x1'));
			const loginToken = location(callback).searchParams.get('loginToken') ?? '';
			const first = await exchange(loginToken);
			expect(first.status).toBe(201);
			expect(sessionCookies(first)).toHaveLength(2);
			const second = await exchange(loginToken);
			expect(second.status).toBe(401);
			expect(sessionCookies(second)).toHaveLength(0);
		});

		it('two concurrent exchanges of one token: only one gets cookies', async () => {
			redis.store.set(
				'oauth2:google:loginToken:t1',
				JSON.stringify({ accessToken: accessToken, refreshToken: 'rt' }),
			);
			const results = await Promise.all([exchange('t1'), exchange('t1')]);
			expect(results.map(r => r.status).sort()).toEqual([201, 401]);
			expect(results.filter(r => sessionCookies(r).length > 0)).toHaveLength(1);
			// read and delete in one command, never GET then DEL
			expect(redis.get).not.toHaveBeenCalledWith('oauth2:google:loginToken:t1');
		});
	});
});
