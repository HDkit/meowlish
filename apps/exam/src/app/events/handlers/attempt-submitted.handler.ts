import { ATTEMPT_SUBMITTED_QUEUE } from '../../../configs/rmq.sub.config';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import { retryAttemptConflicts } from '../../services/attempt-conflict-retry';
import { AttemptScoredPublisher } from '../publishers/attempt-scored.publisher';
import { WritingSubmittedPublisher } from '../publishers/writing-submitted';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InboxService, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

class AttemptSubmittedIntegrationEvent {
	@IsString() attemptId!: string;
}

/**
 * Scores a submitted attempt. Runs from exam's own `exam.attempt.submitted` (written to the outbox
 * in the submit transaction), not in process after the commit: a crash or a failing `score()` is
 * retried by the broker and finally dead-lettered, instead of silently losing
 * `exam.attempt.scored` and the essays' `exam.writing.submitted`.
 */
@Injectable()
export class AttemptSubmittedHandler {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		private readonly attemptScoredPublisher: AttemptScoredPublisher,
		private readonly writingSubmittedPublisher: WritingSubmittedPublisher,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.attempt.submitted',
		...ATTEMPT_SUBMITTED_QUEUE.subscribe,
	})
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		const event = await validatePayload(AttemptSubmittedIntegrationEvent, payload);
		// A post-submit save (note, flag) can bump the version under us: reload and re-score.
		await retryAttemptConflicts(() => this.score(id, event.attemptId));
	}

	/**
	 * Claims the event, saves the score and writes its integration events in one transaction, so a
	 * redelivery after success is skipped and a failure leaves nothing half done.
	 */
	@Transactional()
	private async score(eventId: string, attemptId: string): Promise<void> {
		if (!(await this.inbox.claim(eventId, ATTEMPT_SUBMITTED_QUEUE.name))) return;
		const attempt = await this.attemptRepository.getScoreEvaluator(attemptId);
		if (!attempt) throw new NotFoundException('Attempt not found');
		attempt.evaluateScore();
		await this.attemptRepository.save(attempt);
		const events = attempt.getUncommittedEvents();
		await this.attemptScoredPublisher.publish(events);
		await this.writingSubmittedPublisher.publish(events);
	}
}
