import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../../domain/repositories/ownership.repository';
import type { ResourceCreatedEvent } from '../integration-events';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';

@Injectable()
export class ResourceCreatedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.resource.created',
		queue: 'authorization.events.resource.created',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: ResourceCreatedEvent) {
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
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.resource.deleted',
		queue: 'authorization.events.resource.deleted',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: { resourceType: string; resourceId: string }) {
		this.logger.debug(`Removing ownership: ${payload.resourceType} ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership(payload.resourceType, payload.resourceId);
	}
}
