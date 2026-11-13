import { OAUTH_STATE_COOKIE, oauthStateKey } from '../auth/guards/google-oauth2.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthGatewayController } from './auth.router.controller';
import { AUTH_CLIENT } from './constants/auth';
import { GOOGLE_CALLBACK_PATH } from './google-oauth-frontends';
import { GoogleOAuth2Strategy } from './strategies/google-oauth2.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { generateKeyPairSync } from 'node:crypto';
import { type Server as HttpServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { of } from 'rxjs';

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
		addGoogleCredential: jest.fn(() => of({})),
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
	const putState = (nonce: string, record: object) =>
		redis.store.set(oauthStateKey(nonce), JSON.stringify(record));

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
		strategy.userProfile = (_at, done) => done(null, { id: 'google-1', provider: 'google' });

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
		it('default frontend: BASE_URL callback and no state, as before', async () => {
			const res = await get('/google');
			expect(res.status).toBe(302);
			const url = location(res);
			expect(url.host).toBe('accounts.google.com');
			expect(url.searchParams.get('redirect_uri')).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			expect(url.searchParams.get('state')).toBeNull();
			expect(redis.set).not.toHaveBeenCalled();
		});

		it('naming the default frontend is the same as omitting it', async () => {
			const url = location(await get(`/google?frontend=${encodeURIComponent(`${MAIN}/`)}`));
			expect(url.searchParams.get('redirect_uri')).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			expect(url.searchParams.get('state')).toBeNull();
		});

		it('listed frontend: its own callback, remembered in the state', async () => {
			const url = location(await get(`/google?frontend=${encodeURIComponent(SHARE)}`));
			expect(url.searchParams.get('redirect_uri')).toBe(`${SHARE}${GOOGLE_CALLBACK_PATH}`);
			const state = url.searchParams.get('state') ?? '';
			expect(JSON.parse(redis.store.get(oauthStateKey(state)) ?? '')).toEqual({ frontend: SHARE });
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
			});
			const cookie = res.headers.getSetCookie().find(c => c.startsWith(`${OAUTH_STATE_COOKIE}=`));
			expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${state}`);
			expect(cookie).toContain(`Path=${GOOGLE_CALLBACK_PATH}`);
		});
	});

	describe('callback', () => {
		it('no state: default frontend login', async () => {
			const res = await get('/google/callback?code=c');
			expect(res.status).toBe(302);
			expect(exchangedRedirectUri).toBe(`${MAIN}${GOOGLE_CALLBACK_PATH}`);
			const url = location(res);
			expect(`${url.origin}${url.pathname}`).toBe(`${MAIN}/auth/callback`);
			expect(url.searchParams.get('loginToken')).toBeTruthy();
			expect(authService.registerOrLoginGoogle).toHaveBeenCalled();
		});

		it('login from a listed frontend returns to that frontend', async () => {
			putState('n1', { frontend: SHARE });
			const res = await get('/google/callback?code=c&state=n1');
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
			expect(location(res).origin).toBe(SHARE);
		});

		it('linking without the cookie is 401 and does not burn the state', async () => {
			putState('n3', { identityId: 'user-1' });
			const res = await get('/google/callback?code=c&state=n3', {
				Cookie: `${OAUTH_STATE_COOKIE}=other`,
			});
			expect(res.status).toBe(401);
			expect(redis.store.has(oauthStateKey('n3'))).toBe(true);
			expect(authService.addGoogleCredential).not.toHaveBeenCalled();
		});

		it.each([
			['unknown', undefined],
			['pre-JSON (bare identity id)', 'user-1'],
			['for a frontend no longer listed', JSON.stringify({ frontend: 'https://gone.example' })],
		])('%s state is 401', async (_name, raw) => {
			if (raw !== undefined) redis.store.set(oauthStateKey('n4'), raw);
			const res = await get('/google/callback?code=c&state=n4');
			expect(res.status).toBe(401);
			expect(authService.registerOrLoginGoogle).not.toHaveBeenCalled();
		});
	});
});
