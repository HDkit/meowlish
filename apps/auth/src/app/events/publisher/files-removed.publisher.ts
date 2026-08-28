import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { FileRemovedIntegrationEvent } from '../files-removed.event';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { Job, Queue } from 'bullmq';

@Processor('auth')
export class FilesRemovedPublisher extends WorkerHost {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly amqpConnectionManager: AmqpConnectionManager,
		private readonly logger: AppLoggerService,
	) {
		super();
	}

	get amqpConnection() {
		const connection = this.amqpConnectionManager.getConnection('pub');
		if (!connection) throw new InternalServerErrorException('AMQP "pub" connection not available');
		return connection;
	}

	async process(job: Job) {
		try {
			if (job.name !== 'publish-deleted-files') return;
			while (true) {
				const files = await this.fileRepository.getAndRemoveDeletedFileIds();
				if (files.length === 0) break;
				const message: FileRemovedIntegrationEvent = {
					files: files,
				};
				await this.amqpConnection.publish('eventbus', 'auth.files.removed', message, {
					persistent: true,
				});
			}
			this.logger.log('Finished publishing files to be deleted');
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}

@Injectable()
export class FilesRemovedScheduler implements OnModuleInit {
	constructor(
		@InjectQueue('auth')
		private readonly queue: Queue,
	) {}

	async onModuleInit() {
		await this.queue.add(
			'publish-deleted-files',
			{},
			{
				jobId: 'publish-deleted-files', // prevents duplicates
				repeat: {
					every: 60_000, // every minute
				},
			},
		);
	}
}
