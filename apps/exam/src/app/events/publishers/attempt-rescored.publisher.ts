import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { type AttemptRescoredIntegrationEvent } from '../attempt-rescored.event';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';

/**
 * Writes `exam.attempt.rescored` to the outbox; call it inside the transaction that saved the new
 * score. `exam.attempt.scored` is sent once at submit, before writing feedback exists; this tells
 * consumers (achievement's score badges) about the later change without counting the attempt twice.
 */
@Injectable()
export class AttemptRescoredPublisher {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly outbox: OutboxPublisher,
	) {}

	async publish(
		attemptId: string,
		previousScore: number,
		score: number,
		totalPoints: number,
	): Promise<void> {
		if (score === previousScore) return;
		const attemptedBy = await this.attemptRepository.getAttemptedUser(attemptId);
		if (!attemptedBy) throw new NotFoundException('Could not find user for the attempt');
		const message: AttemptRescoredIntegrationEvent = {
			attemptId: attemptId,
			attemptedBy: attemptedBy,
			previousScore: previousScore,
			score: score,
			totalPoints: totalPoints,
		};
		await this.outbox.add('exam.attempt.rescored', message);
	}
}
