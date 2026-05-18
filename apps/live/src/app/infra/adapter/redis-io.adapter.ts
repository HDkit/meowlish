import { IEnvVars } from '../../../configs/config';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, ServerOptions } from 'socket.io';

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
		const server = super.createIOServer(port, options) as Server;
		if (!this.adapterConstructor) throw Error('Adapter constructor not initialized');
		server.adapter(this.adapterConstructor);
		return server;
	}
}
