import { AuthModule } from './auth.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
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
	authModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
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
	await authModule.listen(process.env.HEALTH_PORT ?? 9101, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
