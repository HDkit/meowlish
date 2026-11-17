import { type EventEnvelope, createEnvelope } from './envelope';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Structural view of a transaction host whose transactional client has the
 * `OutboxEvent` model. Any service's Prisma adapter host satisfies it.
 */
export interface OutboxTransactionHost {
	isTransactionActive(): boolean;
	readonly tx: {
		outboxEvent: {
			create(args: {
				data: { id: string; routingKey: string; payload: unknown };
			}): Promise<unknown>;
		};
	};
}

export interface OutboxAddOptions {
	/**
	 * Publish the bare payload instead of the envelope, for consumers outside this repo that
	 * expect the legacy shape. The AMQP messageId is still the outbox row id.
	 */
	bare?: boolean;
}

@Injectable()
export class OutboxPublisher {
	constructor(@Inject(TransactionHost) private readonly txHost: OutboxTransactionHost) {}

	async add<T>(
		routingKey: string,
		payload: T,
		options: OutboxAddOptions = {},
	): Promise<EventEnvelope<T>> {
		if (!this.txHost.isTransactionActive()) {
			throw new Error('OutboxPublisher.add must run inside a transaction');
		}
		const envelope = createEnvelope(routingKey, payload);
		await this.txHost.tx.outboxEvent.create({
			data: {
				id: envelope.id,
				routingKey: routingKey,
				payload: options.bare ? payload : envelope,
			},
		});
		return envelope;
	}
}
