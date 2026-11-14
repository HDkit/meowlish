import { RpcMetricsInterceptor } from '../metrics/rpc-metrics.interceptor';
import {
	HEALTH_OPTIONS,
	HEALTH_PRISMA,
	HealthController,
	type HealthModuleOptions,
} from './health.controller';
import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { ReadinessRegistry } from './readiness.registry';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';

@Global()
@Module({})
export class HealthModule {
	static forRoot(options: HealthModuleOptions): DynamicModule {
		return {
			module: HealthModule,
			imports: [TerminusModule, ...(options.imports ?? [])],
			controllers: [HealthController],
			providers: [
				ReadinessRegistry,
				RabbitMqHealthIndicator,
				{ provide: APP_INTERCEPTOR, useClass: RpcMetricsInterceptor },
				{ provide: HEALTH_OPTIONS, useValue: options },
				options.prismaToken ?
					{ provide: HEALTH_PRISMA, useExisting: options.prismaToken }
				:	{ provide: HEALTH_PRISMA, useValue: undefined },
			],
			exports: [ReadinessRegistry],
		};
	}
}
