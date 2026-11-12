import { AttemptSubmittedEvent } from '../../../domain/events/attempt.event';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { AttemptScoredPublisher } from '../publishers/attempt-scored.publisher';
import { WritingSubmittedPublisher } from '../publishers/writing-submitted';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, NotFoundException } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { AppLoggerService } from '@server/logger';

@EventsHandler(AttemptSubmittedEvent)
export class AttemptSubmittedHandler implements IEventHandler<AttemptSubmittedEvent> {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly attemptScoredPublisher: AttemptScoredPublisher,
		private readonly writingSubmittedPublisher: WritingSubmittedPublisher,
		private readonly logger: AppLoggerService,
	) {}

	async handle(event: AttemptSubmittedEvent): Promise<void> {
		try {
			await this.score(event.payload.attemptId);
		} catch (e) {
			this.logger.error(e as string);
		}
	}

	/** Saves the score and writes its integration events in one transaction. */
	@Transactional()
	private async score(attemptId: string): Promise<void> {
		const attempt = await this.attemptRepository.getScoreEvaluator(attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		attempt.evaluateScore();
		await this.attemptRepository.save(attempt);
		const events = attempt.getUncommittedEvents();
		await this.attemptScoredPublisher.publish(events);
		await this.writingSubmittedPublisher.publish(events);
	}
}
