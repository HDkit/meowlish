import { ResourceEventsPublisher } from './app/events/resource-events.publisher';
import { BlogCommentService } from './app/services/blog-comment.service';
import { BlogService } from './app/services/blog.service';
import { FileOwnershipService } from './app/services/file-ownership.service';
import { FlashcardForkService } from './app/services/flashcard-fork.service';
import { FlashcardListService } from './app/services/flashcard-list.service';
import { FlashcardProposalService } from './app/services/flashcard-proposal.service';
import { FlashcardService } from './app/services/flashcard.service';
import { ForumService } from './app/services/forum.service';
import { ReportService } from './app/services/report.service';
import { IEnvVars, config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { FILE_CLIENT } from './constants/file';
import { BlogCommentController } from './presentation/controllers/blog-comment.controller';
import { BlogController } from './presentation/controllers/blog.controller';
import { FlashcardListController } from './presentation/controllers/flashcard-list.controller';
import { FlashcardProposalController } from './presentation/controllers/flashcard-proposal.controller';
import { FlashcardController } from './presentation/controllers/flashcard.controller';
import { ForumController } from './presentation/controllers/forum.controller';
import { ReportController } from './presentation/controllers/report.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma-client/resource';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { file } from '@server/generated';
import { LoggerModule } from '@server/logger';
import { MessagingModule } from '@server/messaging';
import { HealthModule } from '@server/telemetry';
import {
	ErrorHandlingGrpcProxy,
	GlobalClassSerializerInterceptor,
	GlobalRpcExceptionFilter,
} from '@server/utils';
import { gRPC2HttpExceptionFilter } from '@server/utils';
import { GlobalValidationPipe } from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

const databaseModule = DatabaseModule.forRoot(PrismaClient);
// shared with MessagingModule so OutboxRelay can resolve AmqpConnectionManager
const rmqPubModule = RabbitMQModule.forRootAsync({
	inject: [ConfigService],
	useFactory: rmqPubConfig,
});

@Module({
	controllers: [
		BlogController,
		BlogCommentController,
		FlashcardController,
		FlashcardListController,
		FlashcardProposalController,
		ForumController,
		ReportController,
	],
	imports: [
		MessagingModule.forRoot({
			serviceName: 'resource',
			prismaToken: DATABASE_SERVICE,
			relay: true,
			imports: [databaseModule, rmqPubModule],
		}),
		HealthModule.forRoot({
			serviceName: 'resource',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
			imports: [databaseModule],
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/resource/.env', '.env'], // nx serve runs from the workspace root
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		CqrsModule.forRoot(),
		rmqPubModule,
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
		BlogCommentService,
		FlashcardService,
		FlashcardListService,
		FlashcardForkService,
		FlashcardProposalService,
		ForumService,
		ReportService,
		ResourceEventsPublisher,
		FileOwnershipService,
		{
			provide: FILE_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const fileConn = configService.getOrThrow('microservicesConnection.file', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: fileConn.url ?? `${fileConn.host}:${fileConn.port}`,
					package: 'file',
					packageDefinition: {
						[`file.${file.FILE_SERVICE_NAME}`]: file.FileServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
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
