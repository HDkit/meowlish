import { BlogService } from './app/services/blog.service';
import { FlashcardListService } from './app/services/flashcard-list.service';
import { FlashcardService } from './app/services/flashcard.service';
import { BlogController } from './presentation/controllers/blog.controller';
import { FlashcardListController } from './presentation/controllers/flashcard-list.controller';
import { FlashcardController } from './presentation/controllers/flashcard.controller';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaClient } from '@prisma-client/resource';
import { DATABASE_SERVICE, DatabaseModule } from '@server/database';
import { LoggerModule } from '@server/logger';
import { Any2RpcExceptionFilter, GlobalClassSerializerInterceptor } from '@server/utils';
import { Http2gRPCExceptionFilter } from '@server/utils';
import { GlobalValidationPipe } from '@server/utils';
import { ClsGuard, ClsModule } from 'nestjs-cls';

@Module({
	controllers: [BlogController, FlashcardController, FlashcardListController],
	imports: [
		ConfigModule.forRoot({
			expandVariables: true,
			cache: true,
			isGlobal: true,
			// load: [config],
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
		LoggerModule.forRoot({ appName: 'ResourceModule' }),
	],
	providers: [
		BlogService,
		FlashcardService,
		FlashcardListService,
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
export class ResourceModule {}
