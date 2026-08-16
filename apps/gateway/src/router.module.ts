import { AchievementGatewayModule } from './achievement-gateway/achievement.router.module';
import { AuthGatewayModule } from './auth-gateway/auth.router.module';
import { ExamGatewayModule } from './exam-gateway/exam.router.module';
import { FileGatewayModule } from './file-gateway/file.router.module';
import { LiveWsGatewayModule } from './live-ws-gateway/live-ws.router.module';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/auth',
				module: AuthGatewayModule,
			},
			{
				path: '/exams',
				module: ExamGatewayModule,
			},
			{
				path: '/files',
				module: FileGatewayModule,
			},
			{
				path: '/achievements',
				module: AchievementGatewayModule,
			},
			{
				path: '/chat/ws',
				module: LiveWsGatewayModule,
			},
		]),
	],
})
export class RouteModule {}
