import { type IEnvVars } from '../configs/config';
import { NOTIFICATION_CLIENT } from './constants/notification';
import { NotificationGatewayController } from './notification.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { notification } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [NotificationGatewayController],
	providers: [
		{
			provide: NOTIFICATION_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.notification', {
					infer: true,
				});
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'notification',
					packageDefinition: {
						[`notification.${notification.NOTIFICATION_SERVICE_NAME}`]:
							notification.NotificationServiceService,
						[`notification.${notification.NOTIFICATION_PREFERENCES_SERVICE_NAME}`]:
							notification.NotificationPreferencesServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [],
})
export class NotificationGatewayModule {}
