import { IdentityLockedEvent } from '../../../domain/events/identity-update.events';
import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/** Writes `auth.user.locked` to the outbox; call it inside the transaction that saved the identity. */
@Injectable()
export class IdentityLockedPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof IdentityLockedEvent)) continue;
			await this.outbox.add('auth.user.locked', {
				identityId: event.payload.identityId,
				lockedBy: event.payload.lockedBy,
			});
		}
	}
}
