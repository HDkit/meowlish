import { AttemptScoredEvent } from '../../../domain/events/attempt.event';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { AttemptScoredIntegrationEvent } from '../attempt-scored.event';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/** Writes `exam.attempt.scored` to the outbox; call it inside the transaction that saved the score. */
@Injectable()
export class AttemptScoredPublisher {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly outbox: OutboxPublisher,
	) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof AttemptScoredEvent)) continue;
			const attemptedBy = await this.attemptRepository.getAttemptedUser(event.payload.attemptId);
			if (!attemptedBy) throw new NotFoundException('Could not find user for the attempt');

			const message: AttemptScoredIntegrationEvent = {
				attemptId: event.payload.attemptId,
				attemptedBy: attemptedBy,
				score: event.payload.score,
				totalPoints: event.payload.totalPoints,
			};
			await this.outbox.add('exam.attempt.scored', message);
		}
	}
}
