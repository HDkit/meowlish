import { AuthorizationModule } from './authorization.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
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
	authorizationModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50058}`,
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
	await authorizationModule.listen(
		process.env.HEALTH_PORT ?? 9108,
		process.env.HOST ?? '127.0.0.1',
	);
}

bootstrap().catch(console.error);
