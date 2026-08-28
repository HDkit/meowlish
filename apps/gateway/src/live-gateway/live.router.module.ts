import { LIVE_CLIENT } from './constants/live';
import { LiveGatewayController } from './live.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { live } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [LiveGatewayController],
	providers: [
		{
			provide: LIVE_CLIENT,
			useFactory: () =>
				new ErrorHandlingGrpcProxy({
					url:
						process.env.LIVE_SERVICE_URL ??
						`${process.env.LIVE_SERVICE_HOST}:${process.env.LIVE_SERVICE_PORT}`,
					package: 'live',
					packageDefinition: {
						[`live.${live.CHAT_SERVICE_NAME}`]: live.ChatServiceService,
					} satisfies PackageDefinition,
				}),
		},
	],
	exports: [],
})
export class LiveGatewayModule {}
