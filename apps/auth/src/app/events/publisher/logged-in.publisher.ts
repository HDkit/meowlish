import { type UserLoggedInEvent } from '../../../domain/events/user-activities.event';
import { UserLoggedInIntegrationEvent } from '../logged-in.event';
import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';

/** Writes `auth.user.login` to the outbox; call it inside the login's transaction. */
@Injectable()
export class UserLoggedInPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async publish(event: UserLoggedInEvent): Promise<void> {
		const message: UserLoggedInIntegrationEvent = {
			uid: event.payload.uid,
			date: event.payload.date.toISOString(),
		};
		await this.outbox.add('auth.user.login', message);
	}
}
