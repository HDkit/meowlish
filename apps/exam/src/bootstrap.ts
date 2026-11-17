import { type IEnvVars } from './configs/config';
import { ExamModule } from './exam.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	const server = examModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	examModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
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
	await examModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
