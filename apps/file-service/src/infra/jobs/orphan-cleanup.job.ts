import { FileService } from '../../app/services/file.service';
import {
	type IFileRepository,
	IFileRepositoryToken,
} from '../../domain/repositories/file.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@prisma-client/file';
import { AppLoggerService } from '@server/logger';
import { Job, Queue } from 'bullmq';

/** Only files untouched (not uploaded or re-referenced) for this long are cleaned up. */
export const MIN_ORPHAN_AGE_MS = 60 * 60 * 1000;
const ORPHAN_BATCH_SIZE = 500;
/** The transaction holds the row locks while the objects are deleted. */
const CLEANUP_TRANSACTION_TIMEOUT_MS = 60_000;

@Processor('file')
export class OrphanCleanupWorker extends WorkerHost {
	constructor(
		@Inject(IFileRepositoryToken) private readonly fileRepository: IFileRepository,
		private readonly fileService: FileService,
		private readonly logger: AppLoggerService,
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
	) {
		super();
	}

	async process(job: Job) {
		try {
			if (job.name !== 'cleanup-orphaned-files') return;
			await this.cleanupOrphans();
		} catch (e) {
			this.logger.error(e as string);
		}
	}

	/**
	 * Locks a batch of orphaned rows, deletes their bucket objects, then the rows, all in one
	 * transaction. A reference arriving meanwhile (`incrementRef`) waits for the lock and then
	 * finds the row gone, so no row survives without its object. If the storage refuses a key,
	 * that row is kept for the next run; if the storage request fails, nothing is deleted.
	 */
	async cleanupOrphans(now = new Date()): Promise<void> {
		const untouchedSince = new Date(now.getTime() - MIN_ORPHAN_AGE_MS);
		await this.txHost.withTransaction({ timeout: CLEANUP_TRANSACTION_TIMEOUT_MS }, async () => {
			const files = await this.fileRepository.lockOrphanedFiles(untouchedSince, ORPHAN_BATCH_SIZE);
			if (files.length === 0) return;
			const removed = await this.fileService.removeObjects(files);
			await this.fileRepository.removeOrphaned(removed);
		});
	}
}

@Injectable()
export class OrphanCleanupScheduler implements OnModuleInit {
	constructor(
		@InjectQueue('file')
		private readonly queue: Queue,
	) {}

	async onModuleInit() {
		await this.queue.add(
			'cleanup-orphaned-files',
			{},
			{
				jobId: 'cleanup-orphaned-files', // prevents duplicates
				repeat: {
					every: 5 * 60_000, // every 5 minutes
				},
			},
		);
	}
}
