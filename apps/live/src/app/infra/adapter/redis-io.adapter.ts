import { IEnvVars } from '../../../configs/config';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';

/**
 * `cors` only covers the polling transport; a WebSocket upgrade is never CORS-checked, and the
 * handshake authenticates with the `access_token` cookie. So every handshake (polling or
 * websocket) must come from a configured origin, or carry no `Origin` at all (non-browser clients).
 */
export const originAllowed =
	(origins: string[]): NonNullable<ServerOptions['allowRequest']> =>
	(req, callback) => {
		const origin = req.headers.origin;
		callback(null, origin === undefined || origins.includes(origin));
	};

export class RedisIoAdapter extends IoAdapter {
	private adapterConstructor?: ReturnType<typeof createAdapter>;

	constructor(
		appOrHttpServer: INestApplicationContext | object,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		super(appOrHttpServer);
	}

	async connectToRedis(): Promise<void> {
		const redisConfig = this.configService.getOrThrow('redis', { infer: true });
		const pubClient = createClient({ url: `redis://${redisConfig.host}:${redisConfig.port}` });
		const subClient = pubClient.duplicate();

		await Promise.all([pubClient.connect(), subClient.connect()]);

		this.adapterConstructor = createAdapter(pubClient, subClient);
	}

	createIOServer(port: number, options?: ServerOptions): any {
		// @WebSocketGateway options are static, so CORS is applied here from config
		const corsOrigins = this.configService.getOrThrow('corsOrigins', { infer: true });
		const server = super.createIOServer(port, {
			...options,
			cors: { origin: corsOrigins.length > 0 ? corsOrigins : false, credentials: true },
			allowRequest: originAllowed(corsOrigins),
		}) as Server;
		if (!this.adapterConstructor) throw Error('Adapter constructor not initialized');
		server.adapter(this.adapterConstructor);
		return server;
	}
}
