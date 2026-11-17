import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../../services/attempt-conflict-retry';
import { RemoveAnswerCommand } from '../../practice/exam.remove-answer.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(RemoveAnswerCommand)
export class RemoveAnswerHandler implements ICommandHandler<RemoveAnswerCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
	) {}

	public async execute(command: RemoveAnswerCommand): Promise<void> {
		// Saves on other questions of the same attempt race on its version: retry those.
		return await retryAttemptConflicts(() => this.apply(command));
	}

	@Transactional()
	private async apply(command: RemoveAnswerCommand): Promise<void> {
		const payload = command.payload;
		const attempt = await this.attemptRepository.findOne(payload.attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		if (payload.answer) attempt.deleteAnswer(payload.questionId, payload.answer);
		else attempt.deleteAnswer(payload.questionId);
		await this.attemptRepository.save(attempt);
	}
}
