import { RESOURCE_CLIENT } from './constants/resource';
import { ResourceGatewayController } from './resource.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { resource } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [ResourceGatewayController],
	providers: [
		{
			provide: RESOURCE_CLIENT,
			useFactory: () =>
				new ErrorHandlingGrpcProxy({
					url:
						process.env.RESOURCE_SERVICE_URL ??
						`${process.env.RESOURCE_SERVICE_HOST}:${process.env.RESOURCE_SERVICE_PORT}`,
					package: 'resource',
					packageDefinition: {
						[`resource.${resource.BLOG_SERVICE_NAME}`]: resource.BlogServiceService,
						[`resource.${resource.FLASH_CARD_SERVICE_NAME}`]: resource.FlashCardServiceService,
						[`resource.${resource.FLASH_CARD_LIST_SERVICE_NAME}`]:
							resource.FlashCardListServiceService,
						[`resource.${resource.REPORT_SERVICE_NAME}`]: resource.ReportServiceService,
					} satisfies PackageDefinition,
				}),
		},
	],
	exports: [],
})
export class ResourceGatewayModule {}
