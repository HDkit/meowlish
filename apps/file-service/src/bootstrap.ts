import { type IEnvVars } from './configs/config';
import { FileModule } from './file.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { file } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const fileModule = await NestFactory.create<NestExpressApplication>(FileModule, {
		bufferLogs: true,
	});
	const server = fileModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	fileModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
				package: 'file',
				packageDefinition: {
					[`file.${file.FILE_SERVICE_NAME}`]: file.FileServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(fileModule);
	await fileModule.startAllMicroservices();
	await fileModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
