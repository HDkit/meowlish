import { AuthModule } from './auth.module';
import { type IEnvVars } from './configs/config';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { auth } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const authModule = await NestFactory.create<NestExpressApplication>(AuthModule, {
		bufferLogs: true,
	});
	const server = authModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	authModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
				package: 'auth',
				packageDefinition: {
					[`auth.${auth.AUTH_SERVICE_NAME}`]: auth.AuthServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(authModule);
	await authModule.startAllMicroservices();
	await authModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
