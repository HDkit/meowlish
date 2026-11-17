import { RedisIoAdapter } from './app/infra/adapter/redis-io.adapter';
import { type IEnvVars } from './configs/config';
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
	const configService = liveModule.get<ConfigService<IEnvVars>>(ConfigService);
	const server = configService.getOrThrow('server', { infer: true });
	const corsOrigins = configService.getOrThrow('corsOrigins', { infer: true });
	liveModule.enableCors({
		origin: corsOrigins.length > 0 ? corsOrigins : false,
		credentials: true,
	});

	liveModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.grpcHost}:${server.grpcPort}`,
				package: 'live',
				packageDefinition: {
					[`live.${live.CHAT_SERVICE_NAME}`]: live.ChatServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	await liveModule.startAllMicroservices();
	useLogger(liveModule);
	await useRedisWsAdapter(liveModule);
	await liveModule.listen(server.httpPort, server.httpHost);
}

bootstrap().catch(console.error);
