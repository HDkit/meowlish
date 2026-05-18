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
export class RoomCreatedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'live.room.created',
		queue: 'authorization.events.room.created',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: ResourceCreatedEvent) {
		this.logger.debug(`Registering ownership: room ${payload.resourceId} -> ${payload.ownerId}`);
		await this.ownershipRepository.registerOwnership('room', payload.resourceId, payload.ownerId);
	}
}

@Injectable()
export class RoomDeletedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'live.room.deleted',
		queue: 'authorization.events.room.deleted',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: { resourceId: string }) {
		this.logger.debug(`Removing ownership: room ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership('room', payload.resourceId);
	}
}
