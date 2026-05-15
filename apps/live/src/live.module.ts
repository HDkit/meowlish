import { ChatLogReadPrismaRepositoryImpl } from './app/infra/repositories/chat-log.read.prisma.repository';
import { RoomPrismaRepositoryImpl } from './app/infra/repositories/room.prisma.repository';
import { RoomReadPrismaRepositoryImpl } from './app/infra/repositories/room.read.prisma.repository';
import { ChatGateway } from './app/services/chat.gateway';
import { ChatService } from './app/services/chat.service';
import { bullConfig } from './configs/bullmq.config';
import { config } from './configs/config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { IChatLogReadRepositoryToken } from './domain/repositories/chat-log.read.repository';
import { IRoomReadRepositoryToken } from './domain/repositories/room.read.repository';
import { IRoomRepositoryToken } from './domain/repositories/room.repository';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PrismaClient } from '@prisma-client/live';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import {
	GlobalClassSerializerInterceptor,
	GlobalHttpExceptionFilter,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
	GlobalWsExceptionFilter,
	HttpExceptionFilter,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

@Module({
	exports: [],
	controllers: [],
	imports: [
		ConfigModule.forRoot({
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
					imports: [DatabaseModule.forRoot(PrismaClient)],
					adapter: new TransactionalAdapterPrisma({
						prismaInjectionToken: DATABASE_SERVICE,
						sqlFlavor: 'postgresql',
					}),
				}),
			],
		}),
		BullModule.forRootAsync({ inject: [ConfigService], useFactory: bullConfig }),
		BullModule.registerQueue({ name: 'live' }),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		LoggerModule.forRoot({ appName: 'LiveModule' }),
	],
	providers: [
		ChatService,
		ChatGateway,
		{
			provide: IChatLogReadRepositoryToken,
			useClass: ChatLogReadPrismaRepositoryImpl,
		},
		{
			provide: IRoomReadRepositoryToken,
			useClass: RoomReadPrismaRepositoryImpl,
		},
		{
			provide: IRoomRepositoryToken,
			useClass: RoomPrismaRepositoryImpl,
		},
		GlobalWsExceptionFilter,
		GlobalRpcExceptionFilter,
		GlobalHttpExceptionFilter,
		HttpExceptionFilter,
		{
			provide: APP_GUARD,
			useClass: ClsGuard,
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
export class LiveModule {}
