import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject, Injectable, UseFilters } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalRmqExceptionFilter } from '@server/utils';
import { IsString } from 'class-validator';

class FileAddedEvent {
	@IsString()
	fileId!: string;
}

@Injectable()
export class FileAddedHandler {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly logger: AppLoggerService,
	) {}

	@UseFilters(GlobalRmqExceptionFilter)
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: '*.file.added',
		queue: 'file.events.file.added',
		queueOptions: {
			durable: true,
		},
	})
	async handle(@RabbitPayload() payload: FileAddedEvent) {
		try {
			await this.fileRepository.incrementRef([payload.fileId]);
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
