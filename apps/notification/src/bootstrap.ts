import { NotificationModule } from './notification.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
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
	notificationModule.enableCors();

	notificationModule.connectMicroservice<MicroserviceOptions>({
		transport: Transport.GRPC,
		options: {
			url: `${process.env.GRPC_HOST ?? '127.0.0.1'}:${process.env.GRPC_PORT ?? 50050}`,
			package: 'notification',
			packageDefinition: {
				[`notification.${notification.NOTIFICATION_SERVICE_NAME}`]:
					notification.NotificationServiceService,
				[`notification.${notification.NOTIFICATION_PREFERENCES_SERVICE_NAME}`]:
					notification.NotificationPreferencesServiceService,
			} satisfies PackageDefinition,
		},
	});
	await notificationModule.startAllMicroservices();
	useLogger(notificationModule);
	await notificationModule.listen(
		process.env.HTTP_PORT ?? 1520,
		process.env.HTTP_HOST ?? '127.0.0.1',
	);
}

bootstrap().catch(console.error);
