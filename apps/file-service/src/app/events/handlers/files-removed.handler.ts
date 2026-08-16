import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateIf } from 'class-validator';

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
		private readonly logger: AppLoggerService,
	) {}

	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: ['*.file.removed', '*.files.removed'],
		queue: 'file.events.files.removed',
		queueOptions: {
			durable: true,
		},
	})
	async handle(@RabbitPayload() payload: FileRemovedEvent) {
		const files = [payload.file, ...payload.files].filter((f): f is FileInfoDto => !!f);
		try {
			await this.fileRepository.decrementRef(files);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
