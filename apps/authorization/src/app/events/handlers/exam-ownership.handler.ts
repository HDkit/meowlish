import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../../domain/repositories/ownership.repository';
import { ResourceCreatedEvent, ResourceDeletedEvent } from '../integration-events';
import { OWNERSHIP_QUEUES } from './ownership-queues';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { InboxService, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
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
		...OWNERSHIP_QUEUES.examCreated.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload: raw } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.examCreated.name))) return;
		const payload = await validatePayload(ResourceCreatedEvent, raw);
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
		...OWNERSHIP_QUEUES.examDeleted.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload: raw } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.examDeleted.name))) return;
		const payload = await validatePayload(ResourceDeletedEvent, raw);
		this.logger.debug(`Removing ownership: exam ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership('exam', payload.resourceId);
	}
}
