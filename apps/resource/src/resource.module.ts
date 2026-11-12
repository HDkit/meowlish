import { ResourceEventsPublisher } from './app/events/resource-events.publisher';
import { BlogService } from './app/services/blog.service';
import { FlashcardListService } from './app/services/flashcard-list.service';
import { FlashcardService } from './app/services/flashcard.service';
import { ReportService } from './app/services/report.service';
import { config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { BlogController } from './presentation/controllers/blog.controller';
import { FlashcardListController } from './presentation/controllers/flashcard-list.controller';
import { FlashcardController } from './presentation/controllers/flashcard.controller';
import { ReportController } from './presentation/controllers/report.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma-client/resource';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import { HealthModule } from '@server/telemetry';
import { GlobalClassSerializerInterceptor, GlobalRpcExceptionFilter } from '@server/utils';
import { gRPC2HttpExceptionFilter } from '@server/utils';
import { GlobalValidationPipe } from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

const databaseModule = DatabaseModule.forRoot(PrismaClient);

@Module({
	controllers: [BlogController, FlashcardController, FlashcardListController, ReportController],
	imports: [
		HealthModule.forRoot({
			serviceName: 'resource',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/resource/.env', '.env'], // nx serve runs from the workspace root
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		CqrsModule.forRoot(),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqPubConfig }),
		ClsModule.forRoot({
			global: true,
			guard: { mount: false },
			plugins: [
				new ClsPluginTransactional({
					imports: [databaseModule],
					adapter: new TransactionalAdapterPrisma({
						prismaInjectionToken: DATABASE_SERVICE,
						sqlFlavor: 'postgresql',
					}),
				}),
			],
		}),
		LoggerModule.forRoot({ appName: 'ResourceModule' }),
	],
	providers: [
		BlogService,
		FlashcardService,
		FlashcardListService,
		ReportService,
		ResourceEventsPublisher,
		{
			provide: APP_GUARD,
			useClass: ClsGuard,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalRpcExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: gRPC2HttpExceptionFilter,
		},
		{
			provide: APP_PIPE,
			useClass: GlobalValidationPipe,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: GlobalClassSerializerInterceptor,
		},
	],
})
export class ResourceModule {}
