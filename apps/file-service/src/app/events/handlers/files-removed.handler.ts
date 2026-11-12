import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { InboxService, deadLetterQueue, unwrapEvent } from '@server/messaging';
import { GlobalRmqExceptionFilter, validatePayload } from '@server/utils';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateIf } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FILES_REMOVED_QUEUE = 'file.events.files.removed';

class FileInfoDto {
	@IsString()
	id!: string;

	@IsNumber()
	count!: number;
}

class FileRemovedEvent {
	@Type(() => FileInfoDto)
	@ValidateIf((o: FileRemovedEvent) => !o.files)
	file?: FileInfoDto;

	@Type(() => FileInfoDto)
	@IsArray()
	@ValidateIf((o: FileRemovedEvent) => !o.file)
	files: FileInfoDto[] = [];
}

@Injectable()
export class FileRemovedHandler {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly inbox: InboxService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: ['*.file.removed', '*.files.removed'],
		...deadLetterQueue(FILES_REMOVED_QUEUE),
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FILES_REMOVED_QUEUE))) return;
		const event = await validatePayload(FileRemovedEvent, payload);
		const files = [event.file, ...event.files].filter((f): f is FileInfoDto => !!f);
		await this.fileRepository.decrementRef(files);
	}
}
