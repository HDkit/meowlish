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
import { Type } from 'class-transformer';
import { IsDate, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const LOGIN_QUEUE = 'achievement.events.user.login';

class LoginEvent {
	@IsString()
	uid!: string;

	@Type(() => Date)
	@IsDate()
	date!: Date;
}

@Injectable()
export class LoginHandler {
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
		routingKey: 'auth.user.login',
		...deadLetterQueue(LOGIN_QUEUE),
	})
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		await inTransactionRetryingConflicts(this.txHost, async () => {
			if (!(await this.inbox.claim(id, LOGIN_QUEUE))) return;
			const event = await validatePayload(LoginEvent, payload);
			const loginBadgeManager = await this.badgeManagerRepository.getLoginBadgeManager(event.uid);
			loginBadgeManager.updateProgress(event.date);
			await this.badgeManagerRepository.saveLoginBadgeManager(loginBadgeManager);
		});
	}
}
