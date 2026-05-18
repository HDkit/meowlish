import { NotificationModule } from './notification.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { notification } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const notificationModule = await NestFactory.createMicroservice<MicroserviceOptions>(
		NotificationModule,
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50060}`,
				package: 'notification',
				packageDefinition: {
					[`notification.${notification.NOTIFICATION_SERVICE_NAME}`]:
						notification.NotificationServiceService,
					[`notification.${notification.NOTIFICATION_PREFERENCES_SERVICE_NAME}`]:
						notification.NotificationPreferencesServiceService,
				} satisfies PackageDefinition,
			},
		},
	);
	useLogger(notificationModule);
	await notificationModule.listen();
}

bootstrap().catch(console.error);
