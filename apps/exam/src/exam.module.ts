import {
	ExamManagementCommandHandlers,
	ExamPracticeCommandHandlers,
} from './app/commands/handlers';
import { IntegrationEventHandlers } from './app/events/handlers';
import { IntegrationEventPublishers } from './app/events/publishers';
import { ExamManagementQueryHandlers } from './app/queries/handlers/management';
import { ExamPracticeQueryHandler } from './app/queries/handlers/practice';
import { GoalService } from './app/services/goal.service';
import { TagService } from './app/services/tag.service';
import { bullConfig } from './configs/bullmq.config';
import { config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { FILE_CLIENT } from './constants/file';
import { ExamEventHandlers } from './domain/events/handlers';
import { IAttemptRepositoryToken } from './domain/repositories/attempt.repository';
import { IExamRepositoryToken } from './domain/repositories/exam.repository';
import { IFileRepositoryToken } from './domain/repositories/file.repository';
import { IGoalRepositoryToken } from './domain/repositories/goal.repository';
import { IManagementReadRepositoryToken } from './domain/repositories/management.read.repository';
import { IPracticeReadRepositoryToken } from './domain/repositories/practice.read.repository';
import { IQuestionRepositoryToken } from './domain/repositories/question.repository';
import { ISectionRepositoryToken } from './domain/repositories/section.repository';
import { ITagReadRepositoryToken } from './domain/repositories/tag.read.repository';
import { ITagRepositoryToken } from './domain/repositories/tag.repository';
import { AttemptPrismaRepositoryImpl } from './infra/repositories/attempt.prisma.repository.impl';
import { ExamPrismaRepositoryImpl } from './infra/repositories/exam.prisma.repository.impl';
import { FilePrismaRepositoryImpl } from './infra/repositories/file.prisma.repository.impl';
import { GoalPrismaRepositoryImpl } from './infra/repositories/goal.prisma.repository.impl';
import { ManagementPrismaRepositoryImpl } from './infra/repositories/management.read.prisma.repository.impl';
import { PracticeReadPrismaRepositoryImpl } from './infra/repositories/practice.read.prisma.repository.impl';
import { QuestionPrismaRepositoryImpl } from './infra/repositories/question.prisma.repository.impl';
import { SectionPrismaRepositoryImpl } from './infra/repositories/section.prisma.repository.impl';
import { TagPrismaRepositoryImpl } from './infra/repositories/tag.prisma.repository.impl';
import { TagReadPrismaRepositoryImpl } from './infra/repositories/tag.read.prisma.repository.impl';
import { ExamManagementController } from './presentation/controllers/exam-management.controller';
import { ExamPracticeController } from './presentation/controllers/exam-practice.controller';
import { GoalController } from './presentation/controllers/goal.controller';
import { TagController } from './presentation/controllers/tag.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma-client/exam';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { file } from '@server/generated';
import { LoggerModule } from '@server/logger';
import {
	Any2RpcExceptionFilter,
	ErrorHandlingGrpcProxy,
	GlobalClassSerializerInterceptor,
} from '@server/utils';
import { Http2gRPCExceptionFilter } from '@server/utils';
import { GlobalValidationPipe } from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

@Module({
	controllers: [ExamManagementController, ExamPracticeController, TagController, GoalController],
	imports: [
		ConfigModule.forRoot({
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		CqrsModule.forRoot(),
		ClsModule.forRoot({
			global: true,
			guard: { mount: false },
			plugins: [
				new ClsPluginTransactional({
					imports: [DatabaseModule.forRoot(PrismaClient)],
					adapter: new TransactionalAdapterPrisma({
						prismaInjectionToken: DATABASE_SERVICE,
						sqlFlavor: 'postgresql',
					}),
				}),
			],
		}),
		BullModule.forRootAsync({ inject: [ConfigService], useFactory: bullConfig }),
		BullModule.registerQueue({ name: 'exam' }),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqPubConfig }),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		LoggerModule.forRoot({ appName: 'ExamModule' }),
	],
	providers: [
		...ExamManagementCommandHandlers,
		...ExamManagementQueryHandlers,
		...ExamPracticeCommandHandlers,
		...ExamPracticeQueryHandler,
		...ExamEventHandlers,
		...IntegrationEventPublishers,
		...IntegrationEventHandlers,
		TagService,
		GoalService,
		{
			provide: FILE_CLIENT,
			useFactory: () =>
				new ErrorHandlingGrpcProxy({
					url:
						process.env.FILE_SERVICE_URL ??
						`${process.env.FILE_SERVICE_HOST}:${process.env.FILE_SERVICE_PORT}`,
					package: 'file',
					packageDefinition: {
						[`file.${file.FILE_SERVICE_NAME}`]: file.FileServiceService,
					} satisfies PackageDefinition,
				}),
		},
		{
			provide: IExamRepositoryToken,
			useClass: ExamPrismaRepositoryImpl,
		},
		{
			provide: ISectionRepositoryToken,
			useClass: SectionPrismaRepositoryImpl,
		},
		{
			provide: IQuestionRepositoryToken,
			useClass: QuestionPrismaRepositoryImpl,
		},
		{
			provide: IAttemptRepositoryToken,
			useClass: AttemptPrismaRepositoryImpl,
		},
		{
			provide: ITagRepositoryToken,
			useClass: TagPrismaRepositoryImpl,
		},
		{
			provide: IFileRepositoryToken,
			useClass: FilePrismaRepositoryImpl,
		},
		{
			provide: IGoalRepositoryToken,
			useClass: GoalPrismaRepositoryImpl,
		},
		{
			provide: IPracticeReadRepositoryToken,
			useClass: PracticeReadPrismaRepositoryImpl,
		},
		{
			provide: IManagementReadRepositoryToken,
			useClass: ManagementPrismaRepositoryImpl,
		},
		{
			provide: ITagReadRepositoryToken,
			useClass: TagReadPrismaRepositoryImpl,
		},
		{
			provide: APP_GUARD,
			useClass: ClsGuard,
		},
		{
			provide: APP_FILTER,
			useClass: Any2RpcExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: Http2gRPCExceptionFilter,
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
export class ExamModule {}
