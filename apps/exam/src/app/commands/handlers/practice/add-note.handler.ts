import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../../services/attempt-conflict-retry';
import { AddNoteCommand } from '../../practice/exam.add-note.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(AddNoteCommand)
export class AddNoteHandler implements ICommandHandler<AddNoteCommand> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
	) {}

	public async execute(command: AddNoteCommand): Promise<void> {
		// Saves on other questions of the same attempt race on its version: retry those.
		return await retryAttemptConflicts(() => this.apply(command));
	}

	@Transactional()
	private async apply(command: AddNoteCommand): Promise<void> {
		const payload = command.payload;
		const attempt = await this.attemptRepository.findOne(payload.attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		attempt.addNote(payload.questionId, payload.note);
		await this.attemptRepository.save(attempt);
	}
}
