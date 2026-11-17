import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../../domain/repositories/attempt.repository';
import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import { AttemptCommand, AttemptCommandResult } from '../../practice/exam.attempt.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(AttemptCommand)
export class AttemptHandler implements ICommandHandler<AttemptCommand> {
	constructor(
		@Inject(IExamRepositoryToken) private readonly examRepository: IExamRepository,
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
	) {}

	public async execute(command: AttemptCommand): Promise<AttemptCommandResult> {
		const payload = command.payload;
		const exam = await this.examRepository.findOne(payload.examId);
		if (!exam) throw new NotFoundException('Exam not found');
		const attemptConfig = exam.createAttempt(payload.userId, {
			durationLimit: payload.options?.duration,
			sectionIds: payload.options?.sectionIds,
		});
		await this.attemptRepository.save(attemptConfig);
		return { id: attemptConfig.id };
	}
}
