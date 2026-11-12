import { AuthGatewayController } from './auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from './auth-gateway/constants/auth';
import { JwtRefreshAuthGuard } from './auth/guards/jwt-refresh-auth.guard';
import { corsOptions } from './cors';
import { LiveWsGatewayController } from './live-ws-gateway/live-ws.router.controller';
import { throttlerOptions } from './throttle';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Controller, type ExecutionContext, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { type Server as HttpServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { of } from 'rxjs';

@Controller()
class FakeHealthController {
	@Get('health/live')
	live() {
		return 'ok';
	}
	@Get('ping')
	ping() {
		return 'pong';
	}
}

describe('gateway throttling and CORS', () => {
	let app: INestApplication;
	let base: string;

	beforeAll(async () => {
		process.env.LIVE_SERVICE_WS_URL = 'http://127.0.0.1:1'; // nothing listens: proxy errors fast
		const tokens = { accessToken: 'not-a-jwt' };
		const authService = {
			loginMail: () => of(tokens),
			registerMail: () => of(tokens),
			refresh: () => of(tokens),
		};
		const moduleRef = await Test.createTestingModule({
			imports: [ThrottlerModule.forRoot(throttlerOptions)],
			controllers: [AuthGatewayController, FakeHealthController, LiveWsGatewayController],
			providers: [
				{ provide: APP_GUARD, useClass: ThrottlerGuard },
				{
					provide: AUTH_CLIENT,
					useValue: { getService: () => authService },
				},
				{ provide: ConfigService, useValue: { getOrThrow: () => 'development' } },
				{ provide: RedisService, useValue: { getOrThrow: () => ({}) } },
			],
		})
			// the refresh guard is not under test: accept the (fake) token, throttling runs first anyway
			.overrideGuard(JwtRefreshAuthGuard)
			.useValue({
				canActivate: (ctx: ExecutionContext) => {
					ctx.switchToHttp().getRequest<{ user: unknown }>().user = { sub: 'identity' };
					return true;
				},
			})
			.compile();
		app = moduleRef.createNestApplication();
		app.enableCors(corsOptions(['https://app.example.com']));
		await app.listen(0, '127.0.0.1');
		base = `http://127.0.0.1:${((app.getHttpServer() as HttpServer).address() as AddressInfo).port}`;
	});

	afterAll(() => app.close());

	const post = (path: string, init: { mail?: string; cookie?: string } = {}) =>
		fetch(`${base}${path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(init.cookie ? { Cookie: init.cookie } : {}),
			},
			body: JSON.stringify(init.mail ? { mail: init.mail, password: 'x' } : {}),
		});
	const fakeJwt = (sub: string) =>
		[{ alg: 'none' }, { sub: sub }]
			.map(part => Buffer.from(JSON.stringify(part)).toString('base64url'))
			.join('.') + '.';

	it('limits one account on one IP to 10 logins per minute', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 11; i++) {
			// case-insensitive: every casing is the same account
			statuses.push(
				(await post('/login', { mail: i % 2 ? 'Same@Example.com' : 'same@example.com' })).status,
			);
		}
		expect(statuses.slice(0, 10).every(s => s === 201)).toBe(true);
		expect(statuses[10]).toBe(429);
	});

	it('gives each account behind one IP its own 10/min login budget', async () => {
		for (let i = 0; i < 10; i++) {
			expect((await post('/login', { mail: 'pupil-a@example.com' })).status).toBe(201);
		}
		expect((await post('/login', { mail: 'pupil-a@example.com' })).status).toBe(429);
		for (let i = 0; i < 10; i++) {
			expect((await post('/login', { mail: 'pupil-b@example.com' })).status).toBe(201);
		}
		expect((await post('/register', { mail: 'pupil-a@example.com' })).status).toBe(201);
	});

	it('falls back to the IP when the login names no account', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 11; i++) statuses.push((await post('/login')).status);
		expect(statuses.slice(0, 10).every(s => s !== 429)).toBe(true);
		expect(statuses[10]).toBe(429);
	});

	it('keys /refresh on the refresh token subject', async () => {
		const as = (sub: string) => post('/refresh', { cookie: `refresh_token=${fakeJwt(sub)}` });
		for (let i = 0; i < 10; i++) expect((await as('identity-1')).status).toBe(201);
		expect((await as('identity-1')).status).toBe(429);
		for (let i = 0; i < 10; i++) expect((await as('identity-2')).status).toBe(201);
		expect((await as('identity-2')).status).toBe(429);
	});

	it('never throttles health routes', async () => {
		for (let i = 0; i < 120; i++) {
			expect((await fetch(`${base}/health/live`)).status).toBe(200);
		}
	});

	it('applies the default 100/min limit to other routes', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 101; i++) statuses.push((await fetch(`${base}/ping`)).status);
		expect(statuses[99]).toBe(200);
		expect(statuses[100]).toBe(429);
	});

	it('does not throttle the socket.io proxy route', async () => {
		for (let i = 0; i < 120; i++) {
			expect((await fetch(`${base}/socket.io/?EIO=4&transport=polling`)).status).not.toBe(429);
		}
	});

	it('sends CORS headers only to allowed origins', async () => {
		const ok = await fetch(`${base}/health/live`, {
			headers: { Origin: 'https://app.example.com' },
		});
		expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
		expect(ok.headers.get('access-control-allow-credentials')).toBe('true');
		const bad = await fetch(`${base}/health/live`, { headers: { Origin: 'https://evil.example' } });
		expect(bad.headers.get('access-control-allow-origin')).toBeNull();
	});
});
