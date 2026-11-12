import { Choice } from '../../../../domain/entities/question.entity';
import {
	type IQuestionRepository,
	IQuestionRepositoryToken,
} from '../../../../domain/repositories/question.repository';
import { FileAddedPublisher } from '../../../events/publishers/file-added.publisher';
import { UpdateQuestionCommand } from '../../staff/exam.update-question.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(UpdateQuestionCommand)
export class UpdateQuestionHandler implements ICommandHandler<UpdateQuestionCommand> {
	constructor(
		@Inject(IQuestionRepositoryToken) private readonly questionRepository: IQuestionRepository,
		private readonly fileAddedPublisher: FileAddedPublisher,
	) {}

	@Transactional()
	public async execute(command: UpdateQuestionCommand): Promise<void> {
		const payload = command.payload;
		const question = await this.questionRepository.findOne(payload.id);
		if (!question) throw new NotFoundException('Question not found');
		question.updateDetails({
			...payload,
		});
		if (payload.deleteChoicesIds) payload.deleteChoicesIds.forEach(id => question.removeChoice(id));
		if (payload.addChoices)
			payload.addChoices.forEach(c =>
				question.addChoice(new Choice({ key: c.key, content: c.content, isCorrect: c.isCorrect })),
			);
		if (payload.updateChoices) payload.updateChoices.forEach(c => question.updateChoice(c.id, c));
		if (payload.addTags) payload.addTags.forEach(t => question.addTag(t));
		if (payload.removeTags) payload.removeTags.forEach(t => question.removeTag(t));
		if (payload.addFiles) payload.addFiles.forEach(t => question.addFile(t));
		if (payload.removeFiles) payload.removeFiles.forEach(t => question.removeFile(t));
		await this.questionRepository.save(question);
		await this.fileAddedPublisher.publish(question.getUncommittedEvents());
	}
}
