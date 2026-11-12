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
			create(args: { data: { id: string; consumer: string } }): Promise<unknown>;
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
	 */
	async claim(eventId: string | undefined, consumer: string): Promise<boolean> {
		if (!this.txHost.isTransactionActive()) {
			throw new Error('InboxService.claim must run inside a transaction');
		}
		if (eventId === undefined) {
			return true;
		}
		try {
			await this.txHost.tx.inboxEvent.create({ data: { id: eventId, consumer: consumer } });
			return true;
		} catch (error) {
			if (isUniqueViolation(error)) {
				this.duplicates.add(1, { service: this.options.serviceName, consumer: consumer });
				return false;
			}
			throw error;
		}
	}
}

function isUniqueViolation(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
