import { type Attempt } from '../../../../domain/entities/attempt.entity';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
	isAttemptVersionConflict,
} from '../../../../domain/repositories/attempt.repository';
import { AttemptSubmittedPublisher } from '../../../events/publishers/attempt-submitted.publisher';
import { EndAttemptCommand } from '../../practice/exam.end-attempt.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { retryOnConflict } from '@server/messaging';

const MAX_END_ATTEMPT_TRIES = 3;

@CommandHandler(EndAttemptCommand)
export class EndAttemptHandler implements ICommandHandler<EndAttemptCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly attemptSubmittedPublisher: AttemptSubmittedPublisher,
		private readonly eventBus: EventBus,
	) {}

	public async execute(command: EndAttemptCommand): Promise<void> {
		// A version conflict means a concurrent save (another submit, an answer) won the race: reload
		// and retry. If that save was a submit, the retry finds the attempt ended and is a no-op.
		const attempt = await retryOnConflict(() => this.endAttempt(command.payload.attemptId), {
			attempts: MAX_END_ATTEMPT_TRIES,
			isConflict: isAttemptVersionConflict,
		});
		// In-process handlers (scoring) run after the commit: started inside the transaction they
		// would inherit its CLS context and keep using the closed transaction client.
		this.eventBus.publishAll(attempt.getUncommittedEvents());
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
