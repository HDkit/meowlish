import { AuthGatewayController } from './auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from './auth-gateway/constants/auth';
import { corsOptions } from './cors';
import { LiveWsGatewayController } from './live-ws-gateway/live-ws.router.controller';
import { throttlerOptions } from './throttle';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Controller, Get, type INestApplication } from '@nestjs/common';
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
		const authService = { loginMail: () => of({}), registerMail: () => of({}) };
		const moduleRef = await Test.createTestingModule({
			imports: [ThrottlerModule.forRoot(throttlerOptions)],
			controllers: [AuthGatewayController, FakeHealthController, LiveWsGatewayController],
			providers: [
				{ provide: APP_GUARD, useClass: ThrottlerGuard },
				{
					provide: AUTH_CLIENT,
					useValue: { getService: () => authService },
				},
				{ provide: ConfigService, useValue: {} },
				{ provide: RedisService, useValue: { getOrThrow: () => ({}) } },
			],
		}).compile();
		app = moduleRef.createNestApplication();
		app.enableCors(corsOptions(['https://app.example.com']));
		await app.listen(0, '127.0.0.1');
		base = `http://127.0.0.1:${((app.getHttpServer() as HttpServer).address() as AddressInfo).port}`;
	});

	afterAll(() => app.close());

	it('returns 429 on login after 10 requests per minute', async () => {
		const statuses: number[] = [];
		for (let i = 0; i < 11; i++) {
			statuses.push((await fetch(`${base}/login`, { method: 'POST' })).status);
		}
		expect(statuses.slice(0, 10).every(s => s === 201)).toBe(true);
		expect(statuses[10]).toBe(429);
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
