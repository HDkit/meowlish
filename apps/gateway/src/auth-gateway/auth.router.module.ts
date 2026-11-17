import { type IEnvVars } from '../configs/config';
import { redisConfig } from '../configs/redis.config';
import { AuthGatewayController } from './auth.router.controller';
import { AUTH_CLIENT } from './constants/auth';
import { GoogleOAuth2Strategy } from './strategies/google-oauth2.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { auth } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	imports: [
		RedisModule.forRootAsync({
			inject: [ConfigService],
			useFactory: redisConfig as (...args: unknown[]) => RedisModuleOptions,
		}),
	],
	controllers: [AuthGatewayController],
	providers: [
		{
			provide: AUTH_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.auth', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'auth',
					packageDefinition: {
						[`auth.${auth.AUTH_SERVICE_NAME}`]: auth.AuthServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
		JwtRefreshStrategy,
		JwtStrategy,
		GoogleOAuth2Strategy,
	],
	exports: [],
})
export class AuthGatewayModule {}
