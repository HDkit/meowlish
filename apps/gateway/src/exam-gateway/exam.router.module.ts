import { type IEnvVars } from '../configs/config';
import { EXAM_CLIENT } from './constants/exam';
import { ExamManagementGatewayController } from './exam-management.router.controller';
import { ExamPracticeGatewayController } from './exam-practice.router.controller';
import { GoalGatewayController } from './goal.router.controller';
import { TagGatewayController } from './tag.router.controller';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exam } from '@server/generated';
import { ErrorHandlingGrpcProxy } from '@server/utils';

@Module({
	controllers: [
		ExamManagementGatewayController,
		ExamPracticeGatewayController,
		TagGatewayController,
		GoalGatewayController,
	],
	providers: [
		{
			provide: EXAM_CLIENT,
			inject: [ConfigService],
			useFactory: (configService: ConfigService<IEnvVars>) => {
				const conn = configService.getOrThrow('microservicesConnection.exam', { infer: true });
				return new ErrorHandlingGrpcProxy({
					url: conn.url ?? `${conn.host}:${conn.port}`,
					package: 'exam',
					packageDefinition: {
						[`exam.${exam.EXAM_MANAGEMENT_SERVICE_NAME}`]: exam.ExamManagementServiceService,
						[`exam.${exam.EXAM_PRACTICE_SERVICE_NAME}`]: exam.ExamPracticeServiceService,
						[`exam.${exam.TAG_SERVICE_NAME}`]: exam.TagServiceService,
						[`exam.${exam.GOAL_SERVICE_NAME}`]: exam.GoalServiceService,
					} satisfies PackageDefinition,
				});
			},
		},
	],
	exports: [],
})
export class ExamGatewayModule {}
