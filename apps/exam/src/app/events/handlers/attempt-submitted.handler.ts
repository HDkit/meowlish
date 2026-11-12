import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../repositories/attempt.repository';
import { AttemptSubmittedEvent } from '../attempt.event';
import { Inject, NotFoundException } from '@nestjs/common';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@EventsHandler(AttemptSubmittedEvent)
export class AttemptSubmittedHandler implements IEventHandler<AttemptSubmittedEvent> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly logger: AppLoggerService,
		private readonly eventBus: EventBus,
	) {}

	async handle(event: AttemptSubmittedEvent) {
		try {
			const payload = event.payload;
			const attempt = await this.attemptRepository.getScoreEvaluator(payload.attemptId);
			if (!attempt) throw new NotFoundException('Attempt not found');
			attempt.evaluateScore();
			await this.attemptRepository.save(attempt);
			this.eventBus.publishAll(attempt.getUncommittedEvents());
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
