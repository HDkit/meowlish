import { type Attempt } from '../../../../domain/entities/attempt.entity';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { AttemptSubmittedPublisher } from '../../../events/publishers/attempt-submitted.publisher';
import { EndAttemptCommand } from '../../practice/exam.end-attempt.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(EndAttemptCommand)
export class EndAttemptHandler implements ICommandHandler<EndAttemptCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly attemptSubmittedPublisher: AttemptSubmittedPublisher,
		private readonly eventBus: EventBus,
	) {}

	public async execute(command: EndAttemptCommand): Promise<void> {
		const attempt = await this.endAttempt(command.payload.attemptId);
		// In-process handlers (scoring) run after the commit: started inside the transaction they
		// would inherit its CLS context and keep using the closed transaction client.
		this.eventBus.publishAll(attempt.getUncommittedEvents());
	}

	@Transactional()
	private async endAttempt(attemptId: string): Promise<Attempt> {
		const attempt = await this.attemptRepository.findOne(attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		attempt.endAttempt();
		await this.attemptRepository.save(attempt);
		await this.attemptSubmittedPublisher.publish(attempt.getUncommittedEvents());
		return attempt;
	}
}
