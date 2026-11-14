import { type IEnvVars } from '../configs/config';
import { FILE_CLIENT } from './constants/file';
import { FileGatewayController } from './file.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { file } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [FileGatewayController],
	providers: [
		{
			provide: FILE_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.file', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'file',
					packageDefinition: {
						[`file.${file.FILE_SERVICE_NAME}`]: file.FileServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [],
})
export class FileGatewayModule {}
