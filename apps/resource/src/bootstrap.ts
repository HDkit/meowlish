import { type IEnvVars } from './configs/config';
import { ResourceModule } from './resource.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	const server = resourceModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	resourceModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
				package: 'resource',
				packageDefinition: {
					[`resource.${resource.BLOG_SERVICE_NAME}`]: resource.BlogServiceService,
					[`resource.${resource.FLASH_CARD_SERVICE_NAME}`]: resource.FlashCardServiceService,
					[`resource.${resource.FLASH_CARD_LIST_SERVICE_NAME}`]:
						resource.FlashCardListServiceService,
					[`resource.${resource.FLASH_CARD_PROPOSAL_SERVICE_NAME}`]:
						resource.FlashCardProposalServiceService,
					[`resource.${resource.REPORT_SERVICE_NAME}`]: resource.ReportServiceService,
					[`resource.${resource.FORUM_SERVICE_NAME}`]: resource.ForumServiceService,
					[`resource.${resource.BLOG_COMMENT_SERVICE_NAME}`]: resource.BlogCommentServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(resourceModule);
	await resourceModule.startAllMicroservices();
	await resourceModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
