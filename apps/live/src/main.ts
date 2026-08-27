import { RedisIoAdapter } from './app/infra/adapter/redis-io.adapter';
import { LiveModule } from './live.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { live } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

const useRedisWsAdapter = async (module: INestApplication) => {
	const redisAdapter = new RedisIoAdapter(module, module.get(ConfigService));
	await redisAdapter.connectToRedis();
	module.useWebSocketAdapter(redisAdapter);
};

async function bootstrap() {
	const liveModule = await NestFactory.create<NestExpressApplication>(LiveModule);
	liveModule.enableCors();

	liveModule.connectMicroservice<MicroserviceOptions>({
		transport: Transport.GRPC,
		options: {
			url: `${process.env.GRPC_HOST ?? '127.0.0.1'}:${process.env.GRPC_PORT ?? 50050}`,
			package: 'live',
			packageDefinition: {
				[`live.${live.CHAT_SERVICE_NAME}`]: live.ChatServiceService,
			} satisfies PackageDefinition,
		},
	});
	await liveModule.startAllMicroservices();
	useLogger(liveModule);
	await useRedisWsAdapter(liveModule);
	await liveModule.listen(process.env.HTTP_PORT ?? 1511, process.env.HTTP_HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
