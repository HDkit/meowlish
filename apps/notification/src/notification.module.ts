import { IntegrationEventHandlers } from './app/events/handlers';
import { NotificationPreferencesService } from './app/services/notification-preferences.service';
import { NotificationSseService } from './app/services/notification-sse.service';
import { NotificationService } from './app/services/notification.service';
import { IEnvVars, config } from './configs/config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { AUTH_CLIENT } from './constants/auth';
import { NotificationPreferencesController } from './presentation/controllers/notification-preferences.controller';
import { NotificationSseController } from './presentation/controllers/notification-sse.controller';
import { NotificationController } from './presentation/controllers/notification.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma-client/notification';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { auth } from '@server/generated';
import { LoggerModule } from '@server/logger';
import { MessagingModule } from '@server/messaging';
import { HealthModule } from '@server/telemetry';
import {
	ErrorHandlingGrpcProxy,
	GlobalClassSerializerInterceptor,
	GlobalRpcExceptionFilter,
	GlobalValidationPipe,
	gRPC2HttpExceptionFilter,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

const databaseModule = DatabaseModule.forRoot(PrismaClient);

@Module({
	controllers: [
		NotificationController,
		NotificationPreferencesController,
		NotificationSseController,
	],
	imports: [
		MessagingModule.forRoot({
			serviceName: 'notification',
			prismaToken: DATABASE_SERVICE,
			relay: false,
			imports: [databaseModule],
		}),
		HealthModule.forRoot({
			serviceName: 'notification',
			prismaToken: DATABASE_SERVICE,
			rabbitmq: true,
			imports: [databaseModule],
		}),
		ConfigModule.forRoot({
			envFilePath: ['apps/notification/.env', '.env'], // nx serve runs from the workspace root
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		CqrsModule.forRoot(),
		EventEmitterModule.forRoot(),
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
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqPubConfig }),
		LoggerModule.forRoot({ appName: 'NotificationModule' }),
	],
	providers: [
		NotificationService,
		NotificationPreferencesService,
		NotificationSseService,
		...IntegrationEventHandlers,
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
export class NotificationModule {}
