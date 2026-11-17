import { IdentityAvatarUpdatedEvent } from '../../../domain/events/identity-update.events';
import { FileAddedIntegrationEvent } from '../file-added.event';
import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/** Writes `auth.file.added` to the outbox; call it inside the transaction that saved the identity. */
@Injectable()
export class FileAddedPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof IdentityAvatarUpdatedEvent) || !event.payload.avatarFileId) continue;
			const message: FileAddedIntegrationEvent = {
				fileId: event.payload.avatarFileId,
			};
			await this.outbox.add('auth.file.added', message);
		}
	}
}
