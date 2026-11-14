import { UserLockedHandler } from './app/events/handlers/user-locked.handler';
import { ChatLogReadPrismaRepositoryImpl } from './app/infra/repositories/chat-log.read.prisma.repository';
import { RoomPrismaRepositoryImpl } from './app/infra/repositories/room.prisma.repository';
import { RoomReadPrismaRepositoryImpl } from './app/infra/repositories/room.read.prisma.repository';
import { ChatController } from './app/presentation/controllers/chat.controller';
import { ChatGateway } from './app/services/chat.gateway';
import { ChatService } from './app/services/chat.service';
import { bullConfig } from './configs/bullmq.config';
import { type IEnvVars } from './configs/config';
import { config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { AUTH_CLIENT } from './constants/auth';
import { IChatLogReadRepositoryToken } from './domain/repositories/chat-log.read.repository';
import { IRoomReadRepositoryToken } from './domain/repositories/room.read.repository';
import { IRoomRepositoryToken } from './domain/repositories/room.repository';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { PrismaClient } from '@prisma-client/live';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { auth } from '@server/generated';
import { LoggerModule } from '@server/logger';
import { MessagingModule } from '@server/messaging';
import { HealthModule } from '@server/telemetry';
import {
	CursorPaginationFactory,
	ErrorHandlingGrpcProxy,
	GlobalClassSerializerInterceptor,
	GlobalHttpExceptionFilter,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
	GlobalWsExceptionFilter,
	HttpExceptionFilter,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

const databaseModule = DatabaseModule.forRoot(PrismaClient);
// shared with MessagingModule so OutboxRelay can resolve AmqpConnectionManager
const rmqPubModule = RabbitMQModule.forRootAsync({
	inject: [ConfigService],
	useFactory: rmqPubConfig,
});

@Module({
	exports: [],
	controllers: [ChatController],
	imports: [
		MessagingModule.forRoot({
			serviceName: 'live',
			prismaToken: DATABASE_SERVICE,
			relay: true,
			imports: [databaseModule, rmqPubModule],
		}),
		HealthModule.forRoot({
			serviceName: 'live',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
			imports: [databaseModule],
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/live/.env', '.env'], // nx serve runs from the workspace root
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
		BullModule.registerQueue({ name: 'live' }),
		rmqPubModule,
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		LoggerModule.forRoot({ appName: 'LiveModule' }),
	],
	providers: [
		CursorPaginationFactory,
		ChatService,
		ChatGateway,
		UserLockedHandler,
		{
			provide: AUTH_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const authService = configService.getOrThrow('authService', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: authService.url ?? `${authService.host}:${authService.port}`,
					package: 'auth',
					packageDefinition: {
						[`auth.${auth.AUTH_SERVICE_NAME}`]: auth.AuthServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
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
		{
			provide: APP_FILTER,
			useClass: GlobalWsExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalRpcExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalHttpExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: HttpExceptionFilter,
		},
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
