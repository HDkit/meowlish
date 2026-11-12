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
export class RoomCreatedHandler {
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
		routingKey: 'live.room.created',
		...deadLetterQueue(OWNERSHIP_QUEUES.roomCreated),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<ResourceCreatedEvent>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.roomCreated))) return;
		this.logger.debug(`Registering ownership: room ${payload.resourceId} -> ${payload.ownerId}`);
		await this.ownershipRepository.registerOwnership('room', payload.resourceId, payload.ownerId);
	}
}

@Injectable()
export class RoomDeletedHandler {
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
		routingKey: 'live.room.deleted',
		...deadLetterQueue(OWNERSHIP_QUEUES.roomDeleted),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<{ resourceId: string }>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.roomDeleted))) return;
		this.logger.debug(`Removing ownership: room ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership('room', payload.resourceId);
	}
}
