import { MockAiScorerModule } from './mock-ai-scorer.module';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppLoggerService } from '@server/logger';
import 'reflect-metadata';

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestExpressApplication>(MockAiScorerModule, {
		bufferLogs: true,
	});
	app.useLogger(app.get(AppLoggerService));
	// No gRPC API: the HTTP listener only serves /health/live and /health/ready.
	await app.listen(process.env.HEALTH_PORT ?? 9110, process.env.HOST ?? '127.0.0.1');
}

bootstrap().catch(console.error);
