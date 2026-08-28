import { Exam } from '../../../../domain/entities/exam.entity';
import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import { ExamStatus } from '../../../../enums/exam-status.enum';
import { CreateExamCommand, CreateExamCommandResult } from '../../staff/exam.create-exam.command';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Inject, InternalServerErrorException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@CommandHandler(CreateExamCommand)
export class CreateExamHandler implements ICommandHandler<CreateExamCommand> {
	constructor(
		@Inject(IExamRepositoryToken) private readonly examRepository: IExamRepository,
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {}

	private get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	public async execute(command: CreateExamCommand): Promise<CreateExamCommandResult> {
		const payload = command.payload;
		const exam = new Exam({
			...payload,
			sections: [],
			status: ExamStatus.Pending,
			tags: [],
		});
		await this.examRepository.save(exam);

		try {
			await this.amqpConnection.publish(
				'eventbus',
				'exam.exam.created',
				{ resourceType: 'exam', resourceId: exam.id.id, ownerId: payload.createdBy },
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(`Failed to publish exam.exam.created event: ${e as string}`);
		}

		return { id: exam.id.id };
	}
}
