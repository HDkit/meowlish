import { AmqpConnection, AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import {
	Inject,
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnModuleDestroy,
} from '@nestjs/common';
import { getMeter } from '@server/telemetry';

export const MESSAGING_PRISMA = Symbol('MESSAGING_PRISMA');
export const OUTBOX_RELAY_OPTIONS = Symbol('OUTBOX_RELAY_OPTIONS');

export interface OutboxRelayOptions {
	serviceName: string;
	connectionName: string;
}

/** Raw-query surface of a Prisma client (or interactive transaction client). */
export interface RawQueryClient {
	$queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
	$executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

export interface OutboxRelayPrisma extends RawQueryClient {
	$transaction<T>(
		fn: (tx: RawQueryClient) => Promise<T>,
		options?: { timeout?: number },
	): Promise<T>;
}

type PublishOptions = NonNullable<Parameters<AmqpConnection['publish']>[3]>;

interface ReturnedMessage {
	properties?: { messageId?: unknown };
}

interface ReturnEmitter {
	on(event: 'return', listener: (message: ReturnedMessage) => void): unknown;
}

interface PendingRow {
	id: string;
	routing_key: string;
	payload: unknown;
	attempts: number;
}

const EXCHANGE = 'eventbus';
const POLL_INTERVAL_MS = 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKOFF_SECONDS = 300;
const TX_TIMEOUT_MS = 60_000;
// amqp-connection-manager queues publishes while disconnected and only rejects on this timeout,
// so without it a broker outage would hang the batch instead of triggering back-off.
const PUBLISH_TIMEOUT_MS = 5000;
const FIRST_CLEANUP_DELAY_MS = 60_000;

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(OutboxRelay.name);
	private readonly errors = getMeter().createCounter('outbox_publish_errors_total', {
		description: 'Outbox events that failed to publish to the broker',
	});
	private relayTimer?: NodeJS.Timeout;
	private cleanupTimer?: NodeJS.Timeout;
	private firstCleanupTimer?: NodeJS.Timeout;
	private running = false;
	/** Message ids the broker returned as unroutable (no queue bound), see `watchReturns`. */
	private readonly returned = new Set<string>();
	private readonly watchedConnections = new WeakSet<object>();

	constructor(
		@Inject(MESSAGING_PRISMA) private readonly prisma: OutboxRelayPrisma,
		private readonly amqp: AmqpConnectionManager,
		@Inject(OUTBOX_RELAY_OPTIONS) private readonly options: OutboxRelayOptions,
	) {}

	onApplicationBootstrap(): void {
		this.registerMetrics();
		this.relayTimer = setInterval(() => {
			this.relayOnce().catch(err =>
				this.logger.error(`Outbox relay run failed: ${errorMessage(err)}`),
			);
		}, POLL_INTERVAL_MS);
		this.cleanupTimer = setInterval(() => {
			this.cleanup().catch(err => this.logger.error(`Outbox cleanup failed: ${errorMessage(err)}`));
		}, CLEANUP_INTERVAL_MS);
		// Services restarted more often than daily would never reach the 24 h tick.
		this.firstCleanupTimer = setTimeout(() => {
			this.cleanup().catch(err => this.logger.error(`Outbox cleanup failed: ${errorMessage(err)}`));
		}, FIRST_CLEANUP_DELAY_MS);
		this.relayTimer.unref();
		this.cleanupTimer.unref();
		this.firstCleanupTimer.unref();
	}

	onModuleDestroy(): void {
		clearInterval(this.relayTimer);
		clearInterval(this.cleanupTimer);
		clearTimeout(this.firstCleanupTimer);
		this.firstCleanupTimer = undefined;
		this.relayTimer = undefined;
		this.cleanupTimer = undefined;
	}

	/**
	 * Records the ids of messages the broker returns (published `mandatory` with no queue bound).
	 * The setup runs on every (re)connected channel of the connection's managed channel.
	 */
	private async watchReturns(connection: AmqpConnection): Promise<void> {
		if (this.watchedConnections.has(connection)) return;
		this.watchedConnections.add(connection);
		await connection.managedChannel.addSetup((channel: ReturnEmitter) => {
			channel.on('return', (message: ReturnedMessage) => {
				const id = message.properties?.messageId;
				if (typeof id === 'string') this.returned.add(id);
			});
		});
	}

	/** Publishes one batch; returns the number published. Returns 0 if a run is already in flight. */
	async relayOnce(): Promise<number> {
		if (this.running) return 0;
		this.running = true;
		try {
			return await this.runBatch();
		} finally {
			this.running = false;
		}
	}

	async cleanup(): Promise<void> {
		await this.prisma
			.$executeRaw`DELETE FROM outbox_events WHERE published_at < now() - interval '7 days'`;
		await this.prisma
			.$executeRaw`DELETE FROM inbox_events WHERE processed_at < now() - interval '7 days'`;
	}

	private async runBatch(): Promise<number> {
		const connection = this.amqp.getConnection(this.options.connectionName);
		if (!connection) {
			throw new Error(`AMQP connection "${this.options.connectionName}" not found`);
		}
		await this.watchReturns(connection);
		return this.prisma.$transaction(
			async tx => {
				const rows = await tx.$queryRaw<PendingRow[]>`
					SELECT id, routing_key, payload, attempts FROM outbox_events
					WHERE published_at IS NULL AND next_attempt_at <= now()
					ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`;
				let published = 0;
				for (const row of rows) {
					try {
						await connection.publish(EXCHANGE, row.routing_key, row.payload, {
							persistent: true,
							// unroutable messages come back instead of being dropped silently
							mandatory: true,
							messageId: row.id,
							timeout: PUBLISH_TIMEOUT_MS,
						} as PublishOptions);
						// The broker sends basic.return before the confirm of the same message, so a
						// returned id is known by the time the publish resolves.
						if (this.returned.delete(row.id)) {
							throw new Error(`unroutable: no queue is bound to ${row.routing_key}`);
						}
					} catch (err) {
						const attempts = row.attempts + 1;
						const delaySeconds = Math.min(2 ** attempts, MAX_BACKOFF_SECONDS);
						const message = errorMessage(err);
						await tx.$executeRaw`
							UPDATE outbox_events SET attempts = ${attempts},
							next_attempt_at = now() + ${delaySeconds}::double precision * interval '1 second',
							last_error = ${message} WHERE id = ${row.id}::uuid`;
						this.errors.add(1, { service: this.options.serviceName });
						this.logger.warn(
							`Publish of outbox event ${row.id} failed (attempt ${attempts}): ${message}`,
						);
						break;
					}
					await tx.$executeRaw`UPDATE outbox_events SET published_at = now() WHERE id = ${row.id}::uuid`;
					published++;
				}
				return published;
			},
			{ timeout: TX_TIMEOUT_MS },
		);
	}

	private registerMetrics(): void {
		const meter = getMeter();
		const pending = meter.createObservableGauge('outbox_pending_events', {
			description: 'Outbox events not yet published',
		});
		const oldest = meter.createObservableGauge('outbox_oldest_pending_age_seconds', {
			description: 'Age of the oldest unpublished outbox event',
		});
		meter.addBatchObservableCallback(
			async result => {
				const attributes = { service: this.options.serviceName };
				try {
					const [stats] = await this.prisma.$queryRaw<{ pending: number; age: number | null }[]>`
						SELECT count(*)::int AS pending,
						extract(epoch FROM now() - min(created_at))::float AS age
						FROM outbox_events WHERE published_at IS NULL`;
					result.observe(pending, stats?.pending ?? 0, attributes);
					result.observe(oldest, stats?.age ?? 0, attributes);
				} catch (err) {
					this.logger.warn(`Outbox metrics query failed: ${errorMessage(err)}`);
				}
			},
			[pending, oldest],
		);
	}
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
