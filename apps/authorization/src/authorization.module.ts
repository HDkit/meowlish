import { OwnershipEventHandlers } from './app/events';
import { OwnershipPrismaRepositoryImpl } from './app/infra/repositories/ownership.prisma.repository';
import { AuthorizationGrpcController } from './app/services/authorization.grpc.controller';
import { config } from './configs/config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { IOwnershipRepositoryToken } from './domain/repositories/ownership.repository';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { PrismaClient } from '@prisma-client/authorization';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import { HealthModule } from '@server/telemetry';
import {
	GlobalRmqExceptionFilter,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

const databaseModule = DatabaseModule.forRoot(PrismaClient);

@Module({
	controllers: [AuthorizationGrpcController],
	imports: [
		HealthModule.forRoot({
			serviceName: 'authorization',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/authorization/.env', '.env'], // nx serve runs from the workspace root
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
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		LoggerModule.forRoot({ appName: 'AuthorizationModule' }),
	],
	providers: [
		...OwnershipEventHandlers,
		{ provide: IOwnershipRepositoryToken, useClass: OwnershipPrismaRepositoryImpl },
		{ provide: APP_FILTER, useClass: GlobalRpcExceptionFilter },
		{ provide: APP_FILTER, useClass: GlobalRmqExceptionFilter },
		{ provide: APP_GUARD, useClass: ClsGuard },
		{ provide: APP_PIPE, useClass: GlobalValidationPipe },
	],
})
export class AuthorizationModule {}
