import { type Attempt } from '../../../../domain/entities/attempt.entity';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { AttemptSubmittedPublisher } from '../../../events/publishers/attempt-submitted.publisher';
import { retryAttemptConflicts } from '../../../services/attempt-conflict-retry';
import { EndAttemptCommand } from '../../practice/exam.end-attempt.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(EndAttemptCommand)
export class EndAttemptHandler implements ICommandHandler<EndAttemptCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly attemptSubmittedPublisher: AttemptSubmittedPublisher,
	) {}

	public async execute(command: EndAttemptCommand): Promise<void> {
		// A version conflict means a concurrent save (another submit, an answer) won the race: reload
		// and retry. If that save was a submit, the retry finds the attempt ended and is a no-op.
		// Scoring runs from exam.attempt.submitted, written to the outbox in the same transaction.
		await retryAttemptConflicts(() => this.endAttempt(command.payload.attemptId));
	}

	@Transactional()
	private async endAttempt(attemptId: string): Promise<Attempt> {
		const attempt = await this.attemptRepository.findOne(attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		// Already submitted: nothing to save, and no second attempt.submitted.
		if (!attempt.endAttempt()) return attempt;
		await this.attemptRepository.save(attempt);
		await this.attemptSubmittedPublisher.publish(attempt.getUncommittedEvents());
		return attempt;
	}
}
