import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../../domain/repositories/file.repository';
import { FileRemovedIntegrationEvent } from '../files-removed.event';
import { Transactional } from '@nestjs-cls/transactional';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { OutboxPublisher } from '@server/messaging';
import { Job, Queue } from 'bullmq';
import { UseCls } from 'nestjs-cls';

@Processor('exam')
export class FilesRemovedPublisher extends WorkerHost {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly outbox: OutboxPublisher,
		private readonly logger: AppLoggerService,
	) {
		super();
	}

	async process(job: Job): Promise<void> {
		if (job.name !== 'publish-deleted-files') return;
		try {
			let more = true;
			while (more) more = await this.publishBatch();
		} catch (e) {
			// Rethrow so BullMQ marks the job failed; the batch rolled back and the rows stay queued.
			this.logger.error(`Failed to publish deleted files: ${String(e)}`);
			throw e;
		}
		this.logger.log('Finished publishing files to be deleted');
	}

	/** Removes one batch of deleted-file rows and writes the event in the same transaction. */
	@UseCls()
	@Transactional()
	private async publishBatch(): Promise<boolean> {
		const files = await this.fileRepository.getAndRemoveDeletedFileIds();
		if (files.length === 0) return false;
		const message: FileRemovedIntegrationEvent = {
			files: files,
		};
		await this.outbox.add('exam.files.removed', message);
		return true;
	}
}

@Injectable()
export class FilesRemovedScheduler implements OnModuleInit {
	constructor(
		@InjectQueue('exam')
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
