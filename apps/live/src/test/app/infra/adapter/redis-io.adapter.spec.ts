import { RedisIoAdapter } from '../../../../app/infra/adapter/redis-io.adapter';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server as Server2, request } from 'node:http';
import { type AddressInfo } from 'node:net';
import { Server } from 'socket.io';

describe('RedisIoAdapter CORS', () => {
	let app: INestApplication;
	let base: string;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({}).compile();
		app = moduleRef.createNestApplication();
		const config = { getOrThrow: () => ['https://app.example.com'] };
		const adapter = new RedisIoAdapter(app, config as never);
		// skip real Redis: a plain in-memory adapter is enough to exercise the CORS options
		(adapter as unknown as { adapterConstructor: unknown }).adapterConstructor = new Server().of(
			'/',
		).adapter.constructor;
		app.useWebSocketAdapter(adapter);
		await app.listen(0, '127.0.0.1');
		// socket.io only attaches once a gateway asks; create the server directly
		adapter.createIOServer(0);
		base = `http://127.0.0.1:${((app.getHttpServer() as Server2).address() as AddressInfo).port}`;
	});

	afterAll(() => app.close());

	const poll = (origin: string) =>
		fetch(`${base}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: origin } });

	it('allows a listed origin with credentials', async () => {
		const res = await poll('https://app.example.com');
		expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
		expect(res.headers.get('access-control-allow-credentials')).toBe('true');
	});

	it('gives no allow header to other origins', async () => {
		const res = await poll('https://evil.example');
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
	});

	it('refuses a polling handshake from a foreign origin', async () => {
		expect((await poll('https://evil.example')).status).toBe(403);
	});

	it('allows a handshake without an Origin (non-browser client)', async () => {
		const res = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
		expect(res.status).toBe(200);
	});

	/** Raw WebSocket upgrade: resolves 101 on success, else the HTTP status of the refusal. */
	const upgrade = (origin: string) =>
		new Promise<number>((resolve, reject) => {
			const req = request(`${base}/socket.io/?EIO=4&transport=websocket`, {
				headers: {
					Connection: 'Upgrade',
					Upgrade: 'websocket',
					'Sec-WebSocket-Version': '13',
					'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
					Origin: origin,
				},
			});
			req.on('upgrade', (_res, socket) => {
				socket.destroy();
				resolve(101);
			});
			req.on('response', res => {
				res.resume();
				resolve(res.statusCode ?? 0);
			});
			req.on('error', reject);
			req.end();
		});

	it('refuses a websocket upgrade from a foreign origin', async () => {
		expect(await upgrade('https://evil.example')).not.toBe(101);
	});

	it('accepts a websocket upgrade from a listed origin', async () => {
		expect(await upgrade('https://app.example.com')).toBe(101);
	});
});
