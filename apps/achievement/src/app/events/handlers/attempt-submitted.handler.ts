import {
	type IBadgeManagerRepository,
	IBadgeManagerRepositoryToken,
} from '../../../domain/repositories/badge-manager.repository';
import {
	RabbitPayload,
	RabbitSubscribe,
	defaultNackErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';
import { IsString } from 'class-validator';

class AttemptSubmittedEvent {
	@IsString()
	attemptedBy!: string;
}

@Injectable()
export class AttemptSubmittedHandler {
	constructor(
		@Inject(IBadgeManagerRepositoryToken)
		private readonly badgeManagerRepository: IBadgeManagerRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.attempt.submitted',
		queue: 'achievement.events.attempt.submitted',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'achievement.dlx',
			deadLetterRoutingKey: 'attempt.submitted.failed',
		},
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: AttemptSubmittedEvent) {
		try {
			const attemptCounterBadgeManager =
				await this.badgeManagerRepository.getAttemptCounterBadgeManager(payload.attemptedBy);
			attemptCounterBadgeManager.updateProgress(1);
			await this.badgeManagerRepository.saveAttemptCounterBadgeManager(attemptCounterBadgeManager);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
