import { backfillSlugs } from '../slugs/slug-backfill';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/resource';

/**
 * Fills missing blog/forum-thread slugs on every start, so each environment converges without a
 * manual step. Runs in the background: startup never waits for it, and a failure is only logged
 * (the next start tries again; rows without a slug still open by id).
 */
@Injectable()
export class SlugBackfillService implements OnApplicationBootstrap {
	private readonly logger = new Logger(SlugBackfillService.name);

	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	onApplicationBootstrap(): void {
		void this.run();
	}

	async run(): Promise<void> {
		try {
			const { filled, skipped } = await backfillSlugs(this.txHost.tx);
			const total = Object.values(filled).reduce((a, b) => a + b, 0);
			if (total > 0) this.logger.log(`Slug backfill: ${JSON.stringify(filled)}`);
			if (Object.values(skipped).some(n => n > 0)) {
				this.logger.warn(`Slug backfill left rows for the next run: ${JSON.stringify(skipped)}`);
			}
		} catch (e) {
			this.logger.error('Slug backfill failed; retrying on the next start', e);
		}
	}
}
