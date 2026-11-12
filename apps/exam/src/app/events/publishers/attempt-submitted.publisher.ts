import { AttemptSubmittedEvent } from '../../../domain/events/attempt.event';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { AttemptSubmittedIntegrationEvent } from '../attempt-submitted.event';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/** Writes `exam.attempt.submitted` to the outbox; call it inside the transaction that ended the attempt. */
@Injectable()
export class AttemptSubmittedPublisher {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly outbox: OutboxPublisher,
	) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof AttemptSubmittedEvent)) continue;
			const attemptedBy = await this.attemptRepository.getAttemptedUser(event.payload.attemptId);
			if (!attemptedBy) throw new NotFoundException('Could not find user for the attempt');

			const message: AttemptSubmittedIntegrationEvent = {
				attemptId: event.payload.attemptId,
				attemptedBy: attemptedBy,
			};
			await this.outbox.add('exam.attempt.submitted', message);
		}
	}
}
