import { AmqpConnectionManager, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Optional } from '@nestjs/common';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';

// `connectionManager` is a private static on RabbitMQModule, so a cast is the only way in.
const sharedManager = (): AmqpConnectionManager =>
	(RabbitMQModule as unknown as { connectionManager: AmqpConnectionManager }).connectionManager;

@Injectable()
export class RabbitMqHealthIndicator {
	constructor(
		private readonly indicatorService: HealthIndicatorService,
		@Optional() private readonly manager?: AmqpConnectionManager,
	) {}

	// RabbitMQModule is not global, so the manager is usually not injectable here;
	// golevelup keeps a process-wide singleton, which we fall back to.
	check(key: string): HealthIndicatorResult {
		const session = this.indicatorService.check(key);
		try {
			const connections = (this.manager ?? sharedManager()).getConnections();
			if (connections.length > 0 && connections.every(c => c.connected)) {
				return session.up();
			}
			return session.down('RabbitMQ connection is not established');
		} catch (error) {
			return session.down(error instanceof Error ? error.message : 'RabbitMQ check failed');
		}
	}
}
