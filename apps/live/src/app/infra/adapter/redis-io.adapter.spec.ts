import { RedisIoAdapter } from './redis-io.adapter';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server as Server2 } from 'node:http';
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
});
