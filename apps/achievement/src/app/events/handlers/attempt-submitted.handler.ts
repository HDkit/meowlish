import {
	type IBadgeManagerRepository,
	IBadgeManagerRepositoryToken,
} from '../../../domain/repositories/badge-manager.repository';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { InboxService, deadLetterQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const ATTEMPT_SUBMITTED_QUEUE = 'achievement.events.attempt.submitted';

class AttemptSubmittedEvent {
	@IsString()
	attemptedBy!: string;
}

@Injectable()
export class AttemptSubmittedHandler {
	constructor(
		@Inject(IBadgeManagerRepositoryToken)
		private readonly badgeManagerRepository: IBadgeManagerRepository,
		private readonly inbox: InboxService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.attempt.submitted',
		...deadLetterQueue(ATTEMPT_SUBMITTED_QUEUE),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, ATTEMPT_SUBMITTED_QUEUE))) return;
		const event = await validatePayload(AttemptSubmittedEvent, payload);
		const attemptCounterBadgeManager =
			await this.badgeManagerRepository.getAttemptCounterBadgeManager(event.attemptedBy);
		attemptCounterBadgeManager.updateProgress(1);
		await this.badgeManagerRepository.saveAttemptCounterBadgeManager(attemptCounterBadgeManager);
	}
}
