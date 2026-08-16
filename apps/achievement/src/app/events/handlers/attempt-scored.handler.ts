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
import { IsNumber, IsString } from 'class-validator';

class AttemptScoredEvent {
	@IsString()
	attemptedBy!: string;

	@IsNumber()
	score!: number;

	@IsNumber()
	totalPoints!: number;
}

@Injectable()
export class AttemptScoredHandler {
	constructor(
		@Inject(IBadgeManagerRepositoryToken)
		private readonly badgeManagerRepository: IBadgeManagerRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.attempt.scored',
		queue: 'achievement.events.attempt.scored',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'achievement.dlx',
			deadLetterRoutingKey: 'attempt.scored.failed',
		},
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: AttemptScoredEvent) {
		try {
			const attemptScoreBadgeManager =
				await this.badgeManagerRepository.getAttemptScoreBadgeManager(payload.attemptedBy);
			attemptScoreBadgeManager.updateProgress(payload.score, payload.totalPoints);
			await this.badgeManagerRepository.saveAttemptScoreBadgeManager(attemptScoreBadgeManager);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
