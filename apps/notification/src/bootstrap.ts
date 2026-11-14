import { type IEnvVars } from './configs/config';
import { NotificationModule } from './notification.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { notification } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const notificationModule = await NestFactory.create<NestExpressApplication>(NotificationModule);
	const server = notificationModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	notificationModule.enableCors();

	notificationModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.grpcHost}:${server.grpcPort}`,
				package: 'notification',
				packageDefinition: {
					[`notification.${notification.NOTIFICATION_SERVICE_NAME}`]:
						notification.NotificationServiceService,
					[`notification.${notification.NOTIFICATION_PREFERENCES_SERVICE_NAME}`]:
						notification.NotificationPreferencesServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	await notificationModule.startAllMicroservices();
	useLogger(notificationModule);
	await notificationModule.listen(server.httpPort, server.httpHost);
}

bootstrap().catch(console.error);
