import { NOTIFICATION_CLIENT } from './constants/notification';
import { NotificationGatewayController } from './notification.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { notification } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [NotificationGatewayController],
	providers: [
		{
			provide: NOTIFICATION_CLIENT,
			useFactory: () =>
				new ErrorHandlingGrpcProxy({
					url:
						process.env.NOTIFICATION_SERVICE_URL ??
						`${process.env.NOTIFICATION_SERVICE_HOST}:${process.env.NOTIFICATION_SERVICE_PORT}`,
					package: 'notification',
					packageDefinition: {
						[`notification.${notification.NOTIFICATION_SERVICE_NAME}`]:
							notification.NotificationServiceService,
						[`notification.${notification.NOTIFICATION_PREFERENCES_SERVICE_NAME}`]:
							notification.NotificationPreferencesServiceService,
					} satisfies PackageDefinition,
				}),
		},
	],
	exports: [],
})
export class NotificationGatewayModule {}
