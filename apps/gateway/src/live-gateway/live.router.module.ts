import { type IEnvVars } from '../configs/config';
import { LIVE_CLIENT } from './constants/live';
import { LiveGatewayController } from './live.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { live } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [LiveGatewayController],
	providers: [
		{
			provide: LIVE_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.live', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'live',
					packageDefinition: {
						[`live.${live.CHAT_SERVICE_NAME}`]: live.ChatServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [],
})
export class LiveGatewayModule {}
