import { ResourceModule } from './resource.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const resourceModule = await NestFactory.createMicroservice<MicroserviceOptions>(ResourceModule, {
		transport: Transport.GRPC,
		options: {
			url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
			package: 'resource',
			packageDefinition: {
				[`resource.${resource.BLOG_SERVICE_NAME}`]: resource.BlogServiceService,
				[`resource.${resource.FLASH_CARD_SERVICE_NAME}`]: resource.FlashCardServiceService,
				[`resource.${resource.FLASH_CARD_LIST_SERVICE_NAME}`]: resource.FlashCardListServiceService,
			} satisfies PackageDefinition,
		},
	});
	useLogger(resourceModule);
	await resourceModule.listen();
}

bootstrap().catch(console.error);
