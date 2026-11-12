import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';

/** Resource types the authorization service tracks ownership for. */
export type OwnedResourceType = 'blog' | 'flashcard';

export interface ReportStatusChangedEvent {
	reportId: string;
	reportedBy: string;
	status: string;
	title: string;
}

/**
 * Publishes integration events on the `eventbus` exchange.
 * Failures are logged, not thrown: the DB write already happened and must not be reported as failed.
 */
@Injectable()
export class ResourceEventsPublisher {
	constructor(
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {}

	async resourceCreated(
		resourceType: OwnedResourceType,
		resourceId: string,
		ownerId: string,
	): Promise<void> {
		await this.publish('resource.resource.created', {
			resourceType: resourceType,
			resourceId: resourceId,
			ownerId: ownerId,
		});
	}

	async resourcesDeleted(resourceType: OwnedResourceType, resourceIds: string[]): Promise<void> {
		await Promise.all(
			resourceIds.map(resourceId =>
				this.publish('resource.resource.deleted', {
					resourceType: resourceType,
					resourceId: resourceId,
				}),
			),
		);
	}

	async reportStatusChanged(event: ReportStatusChangedEvent): Promise<void> {
		await this.publish('resource.report.status-changed', event);
	}

	private async publish(routingKey: string, payload: object): Promise<void> {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) {
			this.logger.error(`AMQP "pub" connection not available; dropped ${routingKey}`);
			return;
		}
		try {
			await connection.publish('eventbus', routingKey, payload, { persistent: true });
		} catch (e) {
			this.logger.error(`Failed to publish ${routingKey}: ${String(e)}`);
		}
	}
}
