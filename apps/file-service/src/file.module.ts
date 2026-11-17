import { IntegrationEventHandlers } from './app/events/handlers';
import { FileService } from './app/services/file.service';
import { bullConfig } from './configs/bullmq.config';
import { config } from './configs/config';
import { minioConfig } from './configs/minio.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { IFileRepositoryToken } from './domain/repositories/file.repository';
import { OrphanCleanupScheduler, OrphanCleanupWorker } from './infra/jobs/orphan-cleanup.job';
import { FilePrismaRepositoryImpl } from './infra/repositories/file.prisma.repository.impl';
import { FileController } from './presentation/controllers/file.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PrismaClient } from '@prisma-client/file';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import { MessagingModule } from '@server/messaging';
import { HealthModule } from '@server/telemetry';
import {
	GlobalClassSerializerInterceptor,
	GlobalRmqExceptionFilter,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';
import { NestMinioModule } from 'nestjs-minio';

const databaseModule = DatabaseModule.forRoot(PrismaClient);
// shared with MessagingModule so OutboxRelay can resolve AmqpConnectionManager
const rmqSubModule = RabbitMQModule.forRootAsync({
	inject: [ConfigService],
	useFactory: rmqSubConfig,
});

@Module({
	controllers: [FileController],
	imports: [
		MessagingModule.forRoot({
			serviceName: 'file-service',
			prismaToken: DATABASE_SERVICE,
			// file-service publishes nothing yet; the relay runs anyway (on its only connection) so
			// outbox metrics and alerts cover it like every other service, and an outbox.add just works
			connectionName: 'sub',
			imports: [databaseModule, rmqSubModule],
		}),
		HealthModule.forRoot({
			serviceName: 'file-service',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
			imports: [databaseModule],
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/file-service/.env', '.env'], // nx serve runs from the workspace root
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
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
		BullModule.forRootAsync({ inject: [ConfigService], useFactory: bullConfig }),
		BullModule.registerQueue({ name: 'file' }),
		rmqSubModule,
		NestMinioModule.registerAsync({ inject: [ConfigService], useFactory: minioConfig }),
		LoggerModule.forRoot({ appName: 'FileModule' }),
	],
	providers: [
		FileService,
		...IntegrationEventHandlers,
		OrphanCleanupScheduler,
		OrphanCleanupWorker,
		{
			provide: IFileRepositoryToken,
			useClass: FilePrismaRepositoryImpl,
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
			useClass: GlobalRmqExceptionFilter,
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
export class FileModule {}
