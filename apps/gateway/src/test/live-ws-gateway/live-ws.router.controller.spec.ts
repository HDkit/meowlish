import { LiveWsGatewayController } from '../../live-ws-gateway/live-ws.router.controller';
import { LiveWsGatewayModule } from '../../live-ws-gateway/live-ws.router.module';
import { Global, type INestApplication, Module, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { type Server as HttpServer, createServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { Server } from 'socket.io';

const ALLOWED_ORIGIN = 'https://app.example.com';

let liveWsUrl = '';

// stands in for the global ConfigModule: the proxy reads its target from config
@Global()
@Module({
	providers: [
		{
			provide: ConfigService,
			useValue: { getOrThrow: () => ({ wsUrl: liveWsUrl }) },
		},
	],
	exports: [ConfigService],
})
class FakeConfigModule {}

@Module({
	imports: [
		FakeConfigModule,
		LiveWsGatewayModule,
		RouterModule.register([{ path: '/chat/ws', module: LiveWsGatewayModule }]),
	],
})
class TestGatewayModule {}

const portOf = (server: HttpServer) => (server.address() as AddressInfo).port;

/**
 * Drives engine.io handshakes through the gateway proxy to a real socket.io server on the default
 * path (`/socket.io/`, matched by strict prefix), as the live service mounts it.
 */
describe('live socket.io proxy', () => {
	let live: HttpServer;
	let io: Server;
	let app: INestApplication;
	let base: string;
	const seenByLive: string[] = [];

	beforeAll(async () => {
		// engine.io hands requests outside its path to the server's own listener: answer 404
		live = createServer((_req, res) => res.writeHead(404).end());
		io = new Server(live, {
			// same check as live's RedisIoAdapter: the browser's Origin must survive the proxy
			allowRequest: (req, callback) => callback(null, req.headers.origin === ALLOWED_ORIGIN),
		});
		live.prependListener('request', req => seenByLive.push(req.url ?? ''));
		live.prependListener('upgrade', req => seenByLive.push(req.url ?? ''));
		await new Promise<void>(resolve => live.listen(0, '127.0.0.1', resolve));
		liveWsUrl = `http://127.0.0.1:${portOf(live)}`;

		const moduleRef = await Test.createTestingModule({ imports: [TestGatewayModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
		app.enableVersioning({ defaultVersion: '1', type: VersioningType.URI });
		await app.listen(0, '127.0.0.1');
		base = `127.0.0.1:${portOf(app.getHttpServer() as HttpServer)}/api/v1/chat/ws/socket.io`;
	});

	afterAll(async () => {
		await app.close();
		await io.close();
	});

	beforeEach(() => (seenByLive.length = 0));

	const poll = (suffix: string, origin = ALLOWED_ORIGIN) =>
		fetch(`http://${base}${suffix}`, { headers: { Origin: origin } });

	// socket.io-client with `path: '/socket.io', addTrailingSlash: false` (the frontend) sends no slash
	it.each(['?EIO=4&transport=polling', '/?EIO=4&transport=polling'])(
		'completes the polling handshake for %s',
		async suffix => {
			const res = await poll(suffix);
			expect(res.status).toBe(200);
			expect(await res.text()).toMatch(/^0\{"sid":"/);
			expect(seenByLive).toEqual([
				expect.stringMatching(/^\/socket\.io\/\?EIO=4&transport=polling/),
			]);
		},
	);

	it.each(['?EIO=4&transport=websocket', '/?EIO=4&transport=websocket'])(
		'completes the websocket handshake for %s',
		async suffix => {
			await poll('?EIO=4&transport=polling'); // the proxy subscribes to upgrades on its first request
			seenByLive.length = 0;
			const ws = new WebSocket(`ws://${base}${suffix}`, { headers: { Origin: ALLOWED_ORIGIN } });
			const open = await new Promise<string>((resolve, reject) => {
				ws.onmessage = event => resolve(String(event.data));
				ws.onerror = () => reject(new Error('websocket handshake failed'));
			});
			ws.close();
			expect(open).toMatch(/^0\{"sid":"/);
			expect(seenByLive).toEqual([
				expect.stringMatching(/^\/socket\.io\/\?EIO=4&transport=websocket/),
			]);
		},
	);

	it('still lets live refuse a handshake from a foreign origin', async () => {
		const res = await poll('?EIO=4&transport=polling', 'https://evil.example');
		expect(res.status).toBe(403);
	});
});

describe('live socket.io proxy, websocket before any HTTP request (C22)', () => {
	let live: HttpServer;
	let io: Server;
	let app: INestApplication;

	beforeAll(async () => {
		live = createServer((_req, res) => res.writeHead(404).end());
		io = new Server(live, { allowRequest: (_req, callback) => callback(null, true) });
		await new Promise<void>(resolve => live.listen(0, '127.0.0.1', resolve));
		liveWsUrl = `http://127.0.0.1:${portOf(live)}`;

		const moduleRef = await Test.createTestingModule({ imports: [TestGatewayModule] }).compile();
		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
		app.enableVersioning({ defaultVersion: '1', type: VersioningType.URI });
		// what bootstrap.ts does
		const liveWs = app.get(LiveWsGatewayController, { strict: false });
		(app.getHttpServer() as HttpServer).on('upgrade', liveWs.handleUpgrade);
		await app.listen(0, '127.0.0.1');
	});

	afterAll(async () => {
		await app.close();
		await io.close();
	});

	it('completes a websocket handshake as the very first request after start-up', async () => {
		const port = portOf(app.getHttpServer() as HttpServer);
		const ws = new WebSocket(
			`ws://127.0.0.1:${port}/api/v1/chat/ws/socket.io/?EIO=4&transport=websocket`,
		);
		const open = await new Promise<string>((resolve, reject) => {
			ws.onmessage = event => resolve(String(event.data));
			ws.onerror = () => reject(new Error('websocket handshake failed'));
		});
		ws.close();
		expect(open).toMatch(/^0\{"sid":"/);
	});
});
