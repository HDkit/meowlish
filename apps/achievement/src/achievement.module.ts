import { IntegrationEventHandlers } from './app/events/handlers';
import { BadgesQueryHandlers } from './app/queries/handlers';
import { config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { IBadgeManagerRepositoryToken } from './domain/repositories/badge-manager.repository';
import { IBadgeReadRepositoryToken } from './domain/repositories/badge.read.repository';
import { BadgeManagerPrismaRepositoryImpl } from './infra/repositories/badge-manager.prisma.repository.impl';
import { BadgeReadPrismaRepositoryImpl } from './infra/repositories/badge.read.prisma.repository.impl';
import { BadgeController } from './presentation/controllers/badge.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma-client/achievement';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import {
	GlobalClassSerializerInterceptor,
	GlobalRmqExceptionFilter,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

@Module({
	controllers: [BadgeController],
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
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqPubConfig }),
		LoggerModule.forRoot({ appName: 'AchievementModule' }),
	],
	providers: [
		...IntegrationEventHandlers,
		...BadgesQueryHandlers,
		{
			provide: IBadgeManagerRepositoryToken,
			useClass: BadgeManagerPrismaRepositoryImpl,
		},
		{
			provide: IBadgeReadRepositoryToken,
			useClass: BadgeReadPrismaRepositoryImpl,
		},
		{
			provide: APP_GUARD,
			useClass: ClsGuard,
		},
		GlobalRpcExceptionFilter,
		GlobalRmqExceptionFilter,
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
export class AchievementModule {}
