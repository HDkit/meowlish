import {
	type IExamRepository,
	IExamRepositoryToken,
} from '../../../../domain/repositories/exam.repository';
import { DeleteExamCommand } from '../../staff/exam.delete-exam.command';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@CommandHandler(DeleteExamCommand)
export class DeleteExamHandler implements ICommandHandler<DeleteExamCommand> {
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

	public async execute(command: DeleteExamCommand): Promise<void> {
		const payload = command.payload;
		const exam = await this.examRepository.findOne(payload.id);
		if (!exam) throw new NotFoundException('Exam not found');
		await this.examRepository.delete(exam);

		try {
			await this.amqpConnection.publish(
				'eventbus',
				'exam.exam.deleted',
				{ resourceId: payload.id },
				{ persistent: true },
			);
		} catch (e) {
			this.logger.error(`Failed to publish exam.exam.deleted event: ${e as string}`);
		}
	}
}
