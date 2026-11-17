import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import { UpdateExamCommand } from '../../staff/exam.update-exam.command';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(UpdateExamCommand)
export class UpdateExamHandler implements ICommandHandler<UpdateExamCommand> {
	constructor(@Inject(IExamRepositoryToken) private readonly examRepository: IExamRepository) {}

	public async execute(command: UpdateExamCommand): Promise<void> {
		const payload = command.payload;
		const exam = await this.examRepository.findOne(payload.id);
		if (!exam) throw new NotFoundException('Exam not found');
		exam.updateDetails(payload);
		if (payload.addTags) payload.addTags.forEach(t => exam.addTag(t));
		if (payload.removeTags) payload.removeTags.forEach(t => exam.removeTag(t));
		await this.examRepository.save(exam);
	}
}
