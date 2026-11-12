import { ExamModule } from './exam.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { exam } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const examModule = await NestFactory.create<NestExpressApplication>(ExamModule, {
		bufferLogs: true,
	});
	examModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
				package: 'exam',
				packageDefinition: {
					[`exam.${exam.EXAM_MANAGEMENT_SERVICE_NAME}`]: exam.ExamManagementServiceService,
					[`exam.${exam.EXAM_PRACTICE_SERVICE_NAME}`]: exam.ExamPracticeServiceService,
					[`exam.${exam.TAG_SERVICE_NAME}`]: exam.TagServiceService,
					[`exam.${exam.GOAL_SERVICE_NAME}`]: exam.GoalServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(examModule);
	await examModule.startAllMicroservices();
	await examModule.listen(process.env.HEALTH_PORT ?? 9102, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
