import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RabbitMqHealthIndicator {
	constructor(
		private readonly indicatorService: HealthIndicatorService,
		private readonly moduleRef: ModuleRef,
	) {}

	// RabbitMQModule is not global, so the manager is resolved lazily from any module.
	check(key: string): HealthIndicatorResult {
		const session = this.indicatorService.check(key);
		try {
			const manager = this.moduleRef.get(AmqpConnectionManager, { strict: false });
			const connections = manager.getConnections();
			if (connections.length > 0 && connections.every(c => c.connected)) {
				return session.up();
			}
			return session.down('RabbitMQ connection is not established');
		} catch (error) {
			return session.down(error instanceof Error ? error.message : 'RabbitMQ check failed');
		}
	}
}
