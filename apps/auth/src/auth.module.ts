import { AuthCommandHandlers } from './app/commands/handlers';
import { IntegrationEventPublishers } from './app/events/publisher';
import { AuthQueryHandlers } from './app/queries/handlers';
import { TokenService } from './app/services/token.service';
import { bullConfig } from './configs/bullmq.config';
import { IEnvVars, config } from './configs/config';
import JwtRefreshConfig from './configs/jwt-refresh.config';
import JwtAccessConfig from './configs/jwt.config';
import { redisConfig } from './configs/redis.config';
import { rmqPubConfig } from './configs/rmq.pub.config';
import { rmqSubConfig } from './configs/rmq.sub.config';
import { FILE_CLIENT } from './constants/file';
import { ICredentialReadRepositoryToken } from './domain/repositories/credential.read.repository';
import { IFileRepositoryToken } from './domain/repositories/file.repository';
import { IIdentityReadRepositoryToken } from './domain/repositories/identity.read.repository';
import { IIdentityRepositoryToken } from './domain/repositories/identity.repository';
import { IRoleReadRepositoryToken } from './domain/repositories/role.read.repository';
import { CredentialReadPrismaRepositoryImpl } from './infra/repositories/credential.read.prisma.repository.impl';
import { FilePrismaRepositoryImpl } from './infra/repositories/file.prisma.repository.impl';
import { IdentityPrismaRepositoryImpl } from './infra/repositories/identity.prisma.repository.impl';
import { IdentityReadPrismaRepositoryImpl } from './infra/repositories/identity.read.prisma.repository.impl';
import { RoleReadPrismaRepositoryImpl } from './infra/repositories/role.read.prisma.repository.impl';
import { AuthController } from './presentation/controllers/auth.controller';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { RedisModule, RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma-client/auth';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { file } from '@server/generated';
import { LoggerModule } from '@server/logger';
import {
	Any2RpcExceptionFilter,
	ErrorHandlingGrpcProxy,
	GlobalClassSerializerInterceptor,
	GlobalValidationPipe,
	Http2gRPCExceptionFilter,
} from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

@Module({
	controllers: [AuthController],
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
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqPubConfig }),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqSubConfig }),
		BullModule.forRootAsync({ inject: [ConfigService], useFactory: bullConfig }),
		BullModule.registerQueue({ name: 'auth' }),
		LoggerModule.forRoot({ appName: 'AuthModule' }),
		RedisModule.forRootAsync({
			inject: [ConfigService],
			useFactory: redisConfig as (...args: unknown[]) => RedisModuleOptions,
		}),
	],
	providers: [
		TokenService,
		...AuthCommandHandlers,
		...AuthQueryHandlers,
		...IntegrationEventPublishers,
		{
			inject: [ConfigService],
			provide: 'JWT_ACCESS_TOKEN',
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const config = JwtAccessConfig(configService);
				return new JwtService(config);
			},
		},
		{
			inject: [ConfigService],
			provide: 'JWT_REFRESH_TOKEN',
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const config = JwtRefreshConfig(configService);
				return new JwtService(config);
			},
		},
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
			provide: IIdentityRepositoryToken,
			useClass: IdentityPrismaRepositoryImpl,
		},
		{
			provide: IIdentityReadRepositoryToken,
			useClass: IdentityReadPrismaRepositoryImpl,
		},
		{
			provide: IRoleReadRepositoryToken,
			useClass: RoleReadPrismaRepositoryImpl,
		},
		{
			provide: ICredentialReadRepositoryToken,
			useClass: CredentialReadPrismaRepositoryImpl,
		},
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
export class AuthModule {}
