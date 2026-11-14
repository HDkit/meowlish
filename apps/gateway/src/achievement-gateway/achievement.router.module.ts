import { type IEnvVars } from '../configs/config';
import { AchievementGatewayController } from './achievement.router.controller';
import { ACHIEVEMENT_CLIENT } from './constants/achievement';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { achievement } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [AchievementGatewayController],
	providers: [
		{
			provide: ACHIEVEMENT_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.achievement', {
					infer: true,
				});
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'achievement',
					packageDefinition: {
						[`achievement.${achievement.ACHIEVEMENT_SERVICE_NAME}`]:
							achievement.AchievementServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [],
})
export class AchievementGatewayModule {}
