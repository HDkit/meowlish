import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';

/** Resource types the authorization service tracks ownership for. */
export type OwnedResourceType = 'blog' | 'flashcard';

export interface ReportStatusChangedEvent {
	reportId: string;
	reportedBy: string;
	status: string;
	title: string;
}

/**
 * Writes integration events to the outbox; the relay publishes them on the `eventbus` exchange.
 * Call these inside the `@Transactional()` method that writes the data they describe.
 */
@Injectable()
export class ResourceEventsPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async resourceCreated(
		resourceType: OwnedResourceType,
		resourceId: string,
		ownerId: string,
	): Promise<void> {
		await this.outbox.add('resource.resource.created', {
			resourceType: resourceType,
			resourceId: resourceId,
			ownerId: ownerId,
		});
	}

	async resourcesDeleted(resourceType: OwnedResourceType, resourceIds: string[]): Promise<void> {
		// Sequential: the outbox rows share one interactive transaction.
		for (const resourceId of resourceIds) {
			await this.outbox.add('resource.resource.deleted', {
				resourceType: resourceType,
				resourceId: resourceId,
			});
		}
	}

	async reportStatusChanged(event: ReportStatusChangedEvent): Promise<void> {
		await this.outbox.add('resource.report.status-changed', event);
	}
}
