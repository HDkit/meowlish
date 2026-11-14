import { AuthorizationModule } from './authorization.module';
import { type IEnvVars } from './configs/config';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { authorization } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const authorizationModule = await NestFactory.create<NestExpressApplication>(
		AuthorizationModule,
		{ bufferLogs: true },
	);
	const server = authorizationModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	authorizationModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
				package: 'authorization',
				packageDefinition: {
					[`authorization.${authorization.AUTHORIZATION_SERVICE_NAME}`]:
						authorization.AuthorizationServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(authorizationModule);
	await authorizationModule.startAllMicroservices();
	await authorizationModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
