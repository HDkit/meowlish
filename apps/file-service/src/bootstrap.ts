import { FileModule } from './file.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
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
	fileModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
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
	await fileModule.listen(process.env.HEALTH_PORT ?? 9106, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
