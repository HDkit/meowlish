import { Exam } from '../../../../domain/entities/exam.entity';
import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import { ExamStatus } from '../../../../enums/exam-status.enum';
import { CreateExamCommand, CreateExamCommandResult } from '../../staff/exam.create-exam.command';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OutboxPublisher } from '@server/messaging';

@CommandHandler(CreateExamCommand)
export class CreateExamHandler implements ICommandHandler<CreateExamCommand> {
	constructor(
		@Inject(IExamRepositoryToken) private readonly examRepository: IExamRepository,
		private readonly outbox: OutboxPublisher,
	) {}

	@Transactional()
	public async execute(command: CreateExamCommand): Promise<CreateExamCommandResult> {
		const payload = command.payload;
		const exam = new Exam({
			...payload,
			sections: [],
			status: ExamStatus.Pending,
			tags: [],
		});
		await this.examRepository.save(exam);

		await this.outbox.add('exam.exam.created', {
			resourceType: 'exam',
			resourceId: exam.id.id,
			ownerId: payload.createdBy,
		});

		return { id: exam.id.id };
	}
}
