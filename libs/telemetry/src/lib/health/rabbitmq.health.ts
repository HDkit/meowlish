import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Optional } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

@Injectable()
export class RabbitMqHealthIndicator {
	constructor(
		private readonly indicatorService: HealthIndicatorService,
		@Optional() private readonly manager?: AmqpConnectionManager,
	) {}

	check(key: string): HealthIndicatorResult {
		const session = this.indicatorService.check(key);
		try {
			const connections = this.manager?.getConnections() ?? [];
			if (connections.length > 0 && connections.every(c => c.connected)) {
				return session.up();
			}
			return session.down('RabbitMQ connection is not established');
		} catch (error) {
			return session.down(error instanceof Error ? error.message : 'RabbitMQ check failed');
		}
	}
}
