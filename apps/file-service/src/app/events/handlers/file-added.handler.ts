import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FILE_ADDED_QUEUE = defineConsumerQueue('file.events.file.added');

class FileAddedEvent {
	@IsString()
	fileId!: string;
}

@Injectable()
export class FileAddedHandler {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly inbox: InboxService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: '*.file.added',
		...FILE_ADDED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FILE_ADDED_QUEUE.name))) return;
		const event = await validatePayload(FileAddedEvent, payload);
		await this.fileRepository.incrementRef([event.fileId]);
	}
}
