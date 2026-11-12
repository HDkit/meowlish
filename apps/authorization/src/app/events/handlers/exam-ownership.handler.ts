import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../../domain/repositories/ownership.repository';
import type { ResourceCreatedEvent } from '../integration-events';
import { OWNERSHIP_QUEUES } from './ownership-queues';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { InboxService, deadLetterQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter } from '@server/utils';
import { UseCls } from 'nestjs-cls';

@Injectable()
export class ExamCreatedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly inbox: InboxService,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.exam.created',
		...deadLetterQueue(OWNERSHIP_QUEUES.examCreated),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<ResourceCreatedEvent>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.examCreated))) return;
		this.logger.debug(`Registering ownership: exam ${payload.resourceId} -> ${payload.ownerId}`);
		await this.ownershipRepository.registerOwnership('exam', payload.resourceId, payload.ownerId);
	}
}

@Injectable()
export class ExamDeletedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly inbox: InboxService,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.exam.deleted',
		...deadLetterQueue(OWNERSHIP_QUEUES.examDeleted),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<{ resourceId: string }>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.examDeleted))) return;
		this.logger.debug(`Removing ownership: exam ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership('exam', payload.resourceId);
	}
}
