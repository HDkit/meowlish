import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../../services/attempt-conflict-retry';
import {
	ToggleFlagCommand,
	ToggleFlagCommandResult,
} from '../../practice/exam.toggle-flag.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(ToggleFlagCommand)
export class ToggleFlagHandler implements ICommandHandler<ToggleFlagCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
	) {}

	public async execute(command: ToggleFlagCommand): Promise<ToggleFlagCommandResult> {
		// Saves on other questions of the same attempt race on its version: retry those.
		return await retryAttemptConflicts(() => this.apply(command));
	}

	@Transactional()
	private async apply(command: ToggleFlagCommand): Promise<ToggleFlagCommandResult> {
		const payload = command.payload;
		const attempt = await this.attemptRepository.findOne(payload.attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		const flagState = attempt.toggleFlag(payload.questionId);
		await this.attemptRepository.save(attempt);
		return { state: flagState };
	}
}
