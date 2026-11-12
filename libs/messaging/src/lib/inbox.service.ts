import { TransactionHost } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { getMeter } from '@server/telemetry';

export const INBOX_OPTIONS = Symbol('INBOX_OPTIONS');

export interface InboxOptions {
	serviceName: string;
}

/**
 * Structural view of a transaction host whose transactional client has the
 * `InboxEvent` model. Any service's Prisma adapter host satisfies it.
 */
export interface InboxTransactionHost {
	isTransactionActive(): boolean;
	readonly tx: {
		inboxEvent: {
			createMany(args: {
				data: { id: string; consumer: string }[];
				skipDuplicates: true;
			}): Promise<{ count: number }>;
		};
	};
}

@Injectable()
export class InboxService {
	private readonly duplicates = getMeter().createCounter('inbox_duplicates_total', {
		description: 'Inbox messages skipped because they were already processed by the consumer',
	});

	constructor(
		@Inject(TransactionHost) private readonly txHost: InboxTransactionHost,
		@Inject(INBOX_OPTIONS) private readonly options: InboxOptions,
	) {}

	/**
	 * Records that `consumer` processed `eventId`. Returns `false` when it was already processed.
	 * Legacy messages without an id cannot be deduplicated, so they are always claimed.
	 * Must run inside a transaction so the claim commits together with the handler's writes.
	 *
	 * Uses `createMany` with `skipDuplicates` (`ON CONFLICT DO NOTHING`) rather than catching a
	 * unique violation: a caught P2002 leaves a PostgreSQL transaction aborted (25P02), which
	 * would fail every later statement in the same handler transaction.
	 */
	async claim(eventId: string | undefined, consumer: string): Promise<boolean> {
		if (!this.txHost.isTransactionActive()) {
			throw new Error('InboxService.claim must run inside a transaction');
		}
		if (eventId === undefined) {
			return true;
		}
		const { count } = await this.txHost.tx.inboxEvent.createMany({
			data: [{ id: eventId, consumer: consumer }],
			skipDuplicates: true,
		});
		if (count === 0) {
			this.duplicates.add(1, { service: this.options.serviceName, consumer: consumer });
		}
		return count === 1;
	}
}
