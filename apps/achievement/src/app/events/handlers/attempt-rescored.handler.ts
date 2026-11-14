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
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { IsNumber, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

/** `exam.attempt.rescored`: an attempt's score changed after AI writing feedback. */
export const ATTEMPT_RESCORED_QUEUE = defineConsumerQueue('achievement.events.attempt.rescored');

class AttemptRescoredEvent {
	@IsString()
	attemptedBy!: string;

	@IsNumber()
	previousScore!: number;

	@IsNumber()
	score!: number;

	@IsNumber()
	totalPoints!: number;
}

@Injectable()
export class AttemptRescoredHandler {
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
		routingKey: 'exam.attempt.rescored',
		...ATTEMPT_RESCORED_QUEUE.subscribe,
	})
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		await inTransactionRetryingConflicts(this.txHost, async () => {
			if (!(await this.inbox.claim(id, ATTEMPT_RESCORED_QUEUE.name))) return;
			const event = await validatePayload(AttemptRescoredEvent, payload);
			const attemptScoreBadgeManager =
				await this.badgeManagerRepository.getAttemptScoreBadgeManager(event.attemptedBy);
			attemptScoreBadgeManager.rescore(event.previousScore, event.score, event.totalPoints);
			await this.badgeManagerRepository.saveAttemptScoreBadgeManager(attemptScoreBadgeManager);
		});
	}
}
