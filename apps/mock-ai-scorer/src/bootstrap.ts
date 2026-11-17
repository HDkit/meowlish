import { type IEnvVars } from './configs/config';
import { MockAiScorerModule } from './mock-ai-scorer.module';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestExpressApplication>(MockAiScorerModule, {
		bufferLogs: true,
	});
	const server = app
		.get<ConfigService<IEnvVars>>(ConfigService)
		.getOrThrow('server', { infer: true });
	app.useLogger(app.get(AppLoggerService));
	// No gRPC API: the HTTP listener only serves /health/live and /health/ready.
	await app.listen(server.healthPort, server.host);
}

bootstrap().catch(console.error);
