import {
	type IBadgeManagerRepository,
	IBadgeManagerRepositoryToken,
} from '../../../domain/repositories/badge-manager.repository';
import { inTransactionRetryingConflicts } from './version-conflict';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import type { PrismaClient } from '@prisma-client/achievement';
import { InboxService, deadLetterQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { IsNumber, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const ATTEMPT_SCORED_QUEUE = 'achievement.events.attempt.scored';

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
		private readonly inbox: InboxService,
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.attempt.scored',
		...deadLetterQueue(ATTEMPT_SCORED_QUEUE),
	})
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		await inTransactionRetryingConflicts(this.txHost, async () => {
			if (!(await this.inbox.claim(id, ATTEMPT_SCORED_QUEUE))) return;
			const event = await validatePayload(AttemptScoredEvent, payload);
			const attemptScoreBadgeManager =
				await this.badgeManagerRepository.getAttemptScoreBadgeManager(event.attemptedBy);
			attemptScoreBadgeManager.updateProgress(event.score, event.totalPoints);
			await this.badgeManagerRepository.saveAttemptScoreBadgeManager(attemptScoreBadgeManager);
		});
	}
}
