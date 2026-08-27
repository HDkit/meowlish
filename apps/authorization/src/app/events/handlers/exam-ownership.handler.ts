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
export class ExamCreatedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.exam.created',
		queue: 'authorization.events.exam.created',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: ResourceCreatedEvent) {
		this.logger.debug(`Registering ownership: exam ${payload.resourceId} -> ${payload.ownerId}`);
		await this.ownershipRepository.registerOwnership('exam', payload.resourceId, payload.ownerId);
	}
}

@Injectable()
export class ExamDeletedHandler {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'exam.exam.deleted',
		queue: 'authorization.events.exam.deleted',
		queueOptions: { durable: true },
	})
	async handle(@RabbitPayload() payload: { resourceId: string }) {
		this.logger.debug(`Removing ownership: exam ${payload.resourceId}`);
		await this.ownershipRepository.removeOwnership('exam', payload.resourceId);
	}
}
