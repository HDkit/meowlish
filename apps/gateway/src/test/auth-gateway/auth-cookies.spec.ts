import { AuthGatewayController } from '../../auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from '../../auth-gateway/constants/auth';
import { JwtRefreshStrategy } from '../../auth-gateway/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '../../auth-gateway/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { type AuthenticatedRequest } from '../../types/authenticated-request';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Controller, Get, type INestApplication, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GlobalClassSerializerInterceptor, HttpResponseTransformInterceptor } from '@server/utils';
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

const sign = (sub: string, expiresIn: number) =>
	jwt.sign({ sub: sub, permissions: [], roles: [], iatMs: Date.now() }, privateKey, {
		algorithm: 'RS256',
		expiresIn: expiresIn,
	});

@Controller('probe')
class ProbeController {
	@Get()
	whoami(@Req() req: AuthenticatedRequest) {
		return req.user.sub;
	}
}

/** All `Set-Cookie` headers, keyed by cookie name. */
const setCookies = (res: Response) =>
	Object.fromEntries(res.headers.getSetCookie().map(c => [c.slice(0, c.indexOf('=')), c]));

describe('auth cookies', () => {
	let app: INestApplication;
	let base: string;
	const accessToken = sign('user-1', 900);
	// shaped like auth's refresh tokens: no roles/permissions, typ REFRESH
	const refreshToken = jwt.sign({ sub: 'user-1', typ: 'REFRESH', iatMs: Date.now() }, privateKey, {
		algorithm: 'RS256',
		expiresIn: 7 * 24 * 3600,
	});
	const authService = {
		loginMail: jest.fn(() => of({ accessToken: accessToken, refreshToken: refreshToken })),
		registerMail: jest.fn(() => of({ accessToken: accessToken, refreshToken: refreshToken })),
		refresh: jest.fn(() => of({ accessToken: accessToken, refreshToken: refreshToken })),
		validateAccess: jest.fn(() => of({})),
		validateRefresh: jest.fn(() => of({ sub: 'user-1', permissions: [], roles: [] })),
		logOutAll: jest.fn(() => of({})),
	};
	const redis = { getdel: jest.fn() };
	const exchange = (loginToken: string) =>
		fetch(`${base}/google/tokens`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ loginToken: loginToken }),
		});
	const config: Record<string, unknown> = {
		jwt: { publicKey: publicKey },
		env: 'development',
		corsOrigins: ['https://app.example.com'],
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [AuthGatewayController, ProbeController],
			providers: [
				JwtStrategy,
				JwtRefreshStrategy,
				{ provide: APP_GUARD, useClass: JwtAuthGuard },
				{ provide: APP_INTERCEPTOR, useClass: HttpResponseTransformInterceptor },
				{ provide: APP_INTERCEPTOR, useClass: GlobalClassSerializerInterceptor },
				{ provide: AUTH_CLIENT, useValue: { getService: () => authService } },
				{ provide: ConfigService, useValue: { getOrThrow: (key: string) => config[key] } },
				{ provide: RedisService, useValue: { getOrThrow: () => redis } },
			],
		}).compile();
		app = moduleRef.createNestApplication();
		await app.listen(0, '127.0.0.1');
		base = `http://127.0.0.1:${((app.getHttpServer() as HttpServer).address() as AddressInfo).port}`;
	});

	afterAll(() => app.close());

	it('login sets HttpOnly cookies and omits tokens from the body', async () => {
		const res = await fetch(`${base}/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { success: boolean; data: unknown };
		expect(body.success).toBe(true);
		expect(body.data).toBeNull();
		expect(JSON.stringify(body)).not.toContain(accessToken);

		const cookies = setCookies(res);
		const access = cookies['access_token'];
		const refresh = cookies['refresh_token'];
		expect(access).toContain(`access_token=${accessToken}`);
		expect(access).toMatch(/HttpOnly/i);
		expect(access).toMatch(/SameSite=Lax/i);
		expect(access).toMatch(/Path=\/(;|$)/);
		expect(access).not.toMatch(/Secure/i); // plain http, development
		expect(Number(/Max-Age=(\d+)/.exec(access)?.[1])).toBeGreaterThan(890);
		expect(Number(/Max-Age=(\d+)/.exec(access)?.[1])).toBeLessThanOrEqual(900);

		expect(refresh).toContain(`refresh_token=${refreshToken}`);
		expect(refresh).toMatch(/HttpOnly/i);
		expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
		expect(Number(/Max-Age=(\d+)/.exec(refresh)?.[1])).toBeGreaterThan(7 * 24 * 3600 - 10);
	});

	it('marks cookies Secure behind an HTTPS proxy', async () => {
		const res = await fetch(`${base}/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
			body: '{}',
		});
		expect(setCookies(res)['access_token']).toMatch(/Secure/);
	});

	it('refuses an access token on /refresh (it would turn 15 minutes into 7 days)', async () => {
		for (const token of [
			sign('user-1', 900),
			jwt.sign({ sub: 'user-1', typ: 'ACCESS' }, privateKey, {
				algorithm: 'RS256',
				expiresIn: 900,
			}),
		]) {
			const res = await fetch(`${base}/refresh`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			});
			expect(res.status).toBe(401);
		}
	});

	it('refuses a refresh token as an access token', async () => {
		const res = await fetch(`${base}/probe`, {
			headers: { Authorization: `Bearer ${refreshToken}` },
		});
		expect(res.status).toBe(401);
	});

	it('refresh reads the refresh cookie and rotates both cookies', async () => {
		const res = await fetch(`${base}/refresh`, {
			method: 'POST',
			headers: { Cookie: `refresh_token=${refreshToken}` },
		});
		expect(res.status).toBe(201);
		expect(((await res.json()) as { data: unknown }).data).toBeNull();
		expect(Object.keys(setCookies(res)).sort()).toEqual(['access_token', 'refresh_token']);
	});

	it('accepts a bearer header when no cookie is present', async () => {
		const res = await fetch(`${base}/probe`, {
			headers: { Authorization: `Bearer ${sign('header-user', 900)}` },
		});
		expect(res.status).toBe(200);
		expect(((await res.json()) as { data: unknown }).data).toBe('header-user');
	});

	it('prefers the cookie over the header', async () => {
		const res = await fetch(`${base}/probe`, {
			headers: {
				Cookie: `other=1; access_token=${sign('cookie-user', 900)}`,
				Authorization: `Bearer ${sign('header-user', 900)}`,
			},
		});
		expect(((await res.json()) as { data: unknown }).data).toBe('cookie-user');
	});

	it('rejects a request with neither cookie nor header', async () => {
		expect((await fetch(`${base}/probe`)).status).toBe(401);
	});

	it('google/tokens swaps the one-time login token for cookies', async () => {
		redis.getdel.mockResolvedValueOnce(
			JSON.stringify({ accessToken: accessToken, refreshToken: refreshToken }),
		);
		const res = await exchange('abc');
		expect(res.status).toBe(201);
		expect(((await res.json()) as { data: unknown }).data).toBeNull();
		expect(Object.keys(setCookies(res)).sort()).toEqual(['access_token', 'refresh_token']);
		expect(redis.getdel).toHaveBeenCalledWith('oauth2:google:loginToken:abc');
	});

	it('google/tokens refuses a form post, so a cross-site form cannot log a victim in', async () => {
		redis.getdel.mockResolvedValue(
			JSON.stringify({ accessToken: accessToken, refreshToken: refreshToken }),
		);
		const res = await fetch(`${base}/google/tokens`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'loginToken=abc',
		});
		expect(res.status).toBe(415);
		expect(res.headers.getSetCookie()).toEqual([]);
		redis.getdel.mockReset();
	});

	it('google/tokens rejects a body without a login token', async () => {
		const res = await fetch(`${base}/google/tokens`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		});
		// 400 from the global ValidationPipe in the app; this test module has no pipe, so the
		// handler sees no token and finds nothing in Redis.
		expect(res.status).toBe(401);
		expect(res.headers.getSetCookie()).toEqual([]);
	});

	it('google/tokens no longer answers GET', async () => {
		expect((await fetch(`${base}/google/tokens?loginToken=abc`)).status).toBe(404);
	});

	it('google/tokens sets no cookie after a linking flow', async () => {
		redis.getdel.mockResolvedValueOnce('true');
		const res = await exchange('link');
		expect(res.status).toBe(201);
		expect(res.headers.getSetCookie()).toEqual([]);
	});

	describe('cookie-issuing routes refuse cross-site requests (login CSRF)', () => {
		const login = (headers: Record<string, string>) =>
			fetch(`${base}/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', ...headers },
				body: '{}',
			});

		it('rejects Sec-Fetch-Site: cross-site with 403 and sets no cookie', async () => {
			const res = await login({ 'Sec-Fetch-Site': 'cross-site' });
			expect(res.status).toBe(403);
			expect(res.headers.getSetCookie()).toEqual([]);
		});

		it('rejects a foreign Origin with 403', async () => {
			expect((await login({ Origin: 'https://evil.example' })).status).toBe(403);
		});

		it('accepts an allowed Origin', async () => {
			const res = await login({ Origin: 'https://app.example.com', 'Sec-Fetch-Site': 'same-site' });
			expect(res.status).toBe(201);
			expect(setCookies(res)['access_token']).toBeDefined();
		});

		it("accepts the gateway's own origin (Swagger UI)", async () => {
			expect((await login({ Origin: base, 'Sec-Fetch-Site': 'same-origin' })).status).toBe(201);
		});

		it('accepts a request with neither header (curl, mobile)', async () => {
			expect((await login({})).status).toBe(201);
		});

		it.each([
			['POST', '/google/tokens'],
			['POST', '/register'],
			['POST', '/refresh'],
			['POST', '/logout'],
		])('also guards %s %s', async (method, path) => {
			const res = await fetch(`${base}${path}`, {
				method: method,
				headers: { 'Sec-Fetch-Site': 'cross-site', Cookie: `refresh_token=${refreshToken}` },
			});
			expect(res.status).toBe(403);
			expect(res.headers.getSetCookie()).toEqual([]);
		});
	});

	it('logout clears cookies', async () => {
		for (const path of ['/logout', '/logout-all']) {
			const res = await fetch(`${base}${path}`, {
				method: 'POST',
				headers: { Cookie: `access_token=${sign('user-1', 900)}` },
			});
			expect(res.status).toBe(201);
			const cookies = setCookies(res);
			expect(cookies['access_token']).toMatch(/^access_token=;.*Path=\/(;|$)/);
			expect(cookies['access_token']).toMatch(/Expires=Thu, 01 Jan 1970/);
			expect(cookies['refresh_token']).toMatch(/^refresh_token=;.*Path=\/api\/v1\/auth/);
		}
		expect(authService.logOutAll).toHaveBeenCalledTimes(1);
	});
});
