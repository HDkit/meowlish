import { ScoringDelay } from './app/scoring-delay';
import { WritingSubmittedHandler } from './app/writing-submitted.handler';
import { config } from './configs/config';
import { rmqConfig } from './configs/rmq.config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@server/logger';
import { HealthModule } from '@server/telemetry';

@Module({
	imports: [
		HealthModule.forRoot({ serviceName: 'mock-ai-scorer', rabbitmq: true }),
		ConfigModule.forRoot({
			envFilePath: ['apps/mock-ai-scorer/.env', '.env'], // nx serve runs from the workspace root
			expandVariables: true,
			cache: true,
			isGlobal: true,
			load: [config],
		}),
		RabbitMQModule.forRootAsync({ inject: [ConfigService], useFactory: rmqConfig }),
		LoggerModule.forRoot({ appName: 'MockAiScorerModule' }),
	],
	providers: [ScoringDelay, WritingSubmittedHandler],
})
export class MockAiScorerModule {}
