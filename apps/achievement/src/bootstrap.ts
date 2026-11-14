import { AchievementModule } from './achievement.module';
import { type IEnvVars } from './configs/config';
import { PackageDefinition } from '@grpc/grpc-js/build/src/make-client';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
	const server = achievementModule
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	achievementModule.connectMicroservice<MicroserviceOptions>(
		{
			transport: Transport.GRPC,
			options: {
				url: `${server.host}:${server.port}`,
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
	await achievementModule.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
