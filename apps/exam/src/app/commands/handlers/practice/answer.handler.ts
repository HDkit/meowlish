import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../../services/attempt-conflict-retry';
import { AnswerCommand } from '../../practice/exam.answer.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(AnswerCommand)
export class AnswerHandler implements ICommandHandler<AnswerCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
	) {}

	public async execute(command: AnswerCommand): Promise<void> {
		// Saves on other questions of the same attempt race on its version: retry those.
		return await retryAttemptConflicts(() => this.apply(command));
	}

	@Transactional()
	private async apply(command: AnswerCommand): Promise<void> {
		const payload = command.payload;
		const attempt = await this.attemptRepository.findOne(payload.attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		attempt.answer(payload.questionId, payload.answer);
		await this.attemptRepository.save(attempt);
	}
}
