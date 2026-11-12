import { ResourceModule } from './resource.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resource } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const resourceModule = await NestFactory.create<NestExpressApplication>(ResourceModule, {
		bufferLogs: true,
	});
	resourceModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
				package: 'resource',
				packageDefinition: {
					[`resource.${resource.BLOG_SERVICE_NAME}`]: resource.BlogServiceService,
					[`resource.${resource.FLASH_CARD_SERVICE_NAME}`]: resource.FlashCardServiceService,
					[`resource.${resource.FLASH_CARD_LIST_SERVICE_NAME}`]:
						resource.FlashCardListServiceService,
					[`resource.${resource.REPORT_SERVICE_NAME}`]: resource.ReportServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(resourceModule);
	await resourceModule.startAllMicroservices();
	await resourceModule.listen(process.env.HEALTH_PORT ?? 9104, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
