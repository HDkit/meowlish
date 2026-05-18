import { AUTHORIZATION_CLIENT } from './constants/authorization';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { authorization } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	providers: [
		{
			provide: AUTHORIZATION_CLIENT,
			useFactory: () =>
				new ErrorHandlingGrpcProxy({
					url:
						process.env.AUTHORIZATION_SERVICE_URL ??
						`${process.env.AUTHORIZATION_SERVICE_HOST}:${process.env.AUTHORIZATION_SERVICE_PORT}`,
					package: 'authorization',
					packageDefinition: {
						[`authorization.${authorization.AUTHORIZATION_SERVICE_NAME}`]:
							authorization.AuthorizationServiceService,
					} satisfies PackageDefinition,
				}),
		},
	],
	exports: [AUTHORIZATION_CLIENT],
})
export class AuthorizationGatewayModule {}
