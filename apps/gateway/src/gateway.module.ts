import { AchievementGatewayModule } from './achievement-gateway/achievement.router.module';
import { AuthGatewayModule } from './auth-gateway/auth.router.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { config } from './configs/config';
import { ExamGatewayModule } from './exam-gateway/exam.router.module';
import { FileGatewayModule } from './file-gateway/file.router.module';
import { LiveWsGatewayModule } from './live-ws-gateway/live-ws.router.module';
import { RouteModule } from './router.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from '@server/logger';
import {
	GlobalClassSerializerInterceptor,
	GlobalHttpExceptionFilter,
	gRPC2HttpExceptionFilter,
} from '@server/utils';
import { HttpExceptionFilter } from '@server/utils';
import { HttpResponseTransformInterceptor } from '@server/utils';
import { GlobalValidationPipe } from '@server/utils';

@Module({
	imports: [
		ConfigModule.forRoot({
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		CqrsModule.forRoot(),
		LoggerModule.forRoot({ appName: 'GatewayModule' }),
		ThrottlerModule.forRoot({
			throttlers: [
				{
					ttl: 60000,
					limit: 60,
				},
			],
			errorMessage: 'Rate limit reached',
		}),
		RouteModule,
		AuthGatewayModule,
		ExamGatewayModule,
		FileGatewayModule,
		AchievementGatewayModule,
		// ws proxy modules
		LiveWsGatewayModule,
	],
	providers: [
		{
			provide: APP_PIPE,
			useClass: GlobalValidationPipe,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		{
			provide: APP_GUARD,
			useClass: PermissionsGuard,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalHttpExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: gRPC2HttpExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: HttpExceptionFilter,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: HttpResponseTransformInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: GlobalClassSerializerInterceptor,
		},
	],
	exports: [],
})
export class GatewayModule {}
