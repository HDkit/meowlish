import { type IEnvVars } from '../configs/config';
import { AUTHORIZATION_CLIENT } from './constants/authorization';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authorization } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	providers: [
		{
			provide: AUTHORIZATION_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.authorization', {
					infer: true,
				});
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'authorization',
					packageDefinition: {
						[`authorization.${authorization.AUTHORIZATION_SERVICE_NAME}`]:
							authorization.AuthorizationServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [AUTHORIZATION_CLIENT],
})
export class AuthorizationGatewayModule {}
