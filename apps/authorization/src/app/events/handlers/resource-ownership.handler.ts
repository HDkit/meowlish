import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../../domain/repositories/ownership.repository';
import { TypedResourceCreatedEvent, TypedResourceDeletedEvent } from '../integration-events';
import { OWNERSHIP_QUEUES } from './ownership-queues';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { InboxService, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { UseCls } from 'nestjs-cls';

@Injectable()
export class ResourceCreatedHandler {
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
		routingKey: 'resource.resource.created',
		...OWNERSHIP_QUEUES.resourceCreated.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload: raw } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.resourceCreated.name))) return;
		const payload = await validatePayload(TypedResourceCreatedEvent, raw);
		this.logger.debug(
			`Registering ownership: ${payload.resourceType} ${payload.resourceId} -> ${payload.ownerId}`,
		);
		await this.ownershipRepository.registerOwnership(
			payload.resourceType,
			payload.resourceId,
			payload.ownerId,
		);
	}
}

@Injectable()
export class ResourceDeletedHandler {
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
		routingKey: 'resource.resource.deleted',
		...OWNERSHIP_QUEUES.resourceDeleted.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload: raw } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, OWNERSHIP_QUEUES.resourceDeleted.name))) return;
		const payload = await validatePayload(TypedResourceDeletedEvent, raw);
		this.logger.debug(`Removing ownership: ${payload.resourceType} ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership(payload.resourceType, payload.resourceId);
	}
}
