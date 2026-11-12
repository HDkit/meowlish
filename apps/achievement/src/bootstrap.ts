import { AchievementModule } from './achievement.module';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { achievement } from '@server/generated';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

const useLogger = (module: INestApplicationContext) => {
	const logger = module.get(AppLoggerService);
	module.useLogger(logger);
};

async function bootstrap() {
	const achievementModule = await NestFactory.create<NestExpressApplication>(AchievementModule, {
		bufferLogs: true,
	});
	achievementModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${process.env.HOST ?? '127.0.0.1'}:${process.env.PORT ?? 50050}`,
				package: 'achievement',
				packageDefinition: {
					[`achievement.${achievement.ACHIEVEMENT_SERVICE_NAME}`]:
						achievement.AchievementServiceService,
				} satisfies PackageDefinition,
			},
		},
		{ inheritAppConfig: true },
	);
	useLogger(achievementModule);
	await achievementModule.startAllMicroservices();
	await achievementModule.listen(process.env.HEALTH_PORT ?? 9103, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
