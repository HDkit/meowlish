import type { MessageHandlerOptions, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { getMeter } from '@server/telemetry';

export const DEAD_LETTER_EXCHANGE = 'eventbus.dlx';

/** Header carrying how many times a message has already been retried. */
export const RETRY_COUNT_HEADER = 'x-retry-count';

type MessageErrorHandler = NonNullable<MessageHandlerOptions['errorHandler']>;
type QueueConfig = NonNullable<RabbitMQConfig['queues']>[number];
// amqplib types, taken from golevelup's signature so this lib needs no direct amqplib dependency.
type Channel = Parameters<MessageErrorHandler>[0];
type ConsumeMessage = Extract<Parameters<MessageErrorHandler>[1], { content: Buffer }>;
type PublishOptions = NonNullable<Parameters<Channel['publish']>[3]>;
type PublishCallback = (err: unknown, ok: unknown) => void;
/** A confirm channel's `publish` takes a callback invoked once the broker confirms or nacks. */
type ConfirmChannel = Omit<Channel, 'publish'> & {
	publish(
		exchange: string,
		routingKey: string,
		content: Buffer,
		options: PublishOptions,
		callback?: PublishCallback,
	): boolean;
	waitForConfirms(): Promise<void>;
};

export interface RetryOptions {
	/** Retries after the first delivery before dead-lettering. Default 5. */
	maxAttempts?: number;
	/** Delay before the first retry; doubles per retry. Default 1000 ms. */
	baseDelayMs?: number;
	/** Upper bound for a single delay. Default 60000 ms. */
	maxDelayMs?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
	maxAttempts: 5,
	baseDelayMs: 1000,
	maxDelayMs: 60_000,
};

function retryPolicy(opts?: RetryOptions): Required<RetryOptions> {
	return { ...DEFAULT_RETRY, ...opts };
}

/** Name of the delay queue used for retry number `attempt` (1-based). */
export function retryQueueName(queue: string, attempt: number): string {
	return `${queue}.retry.${attempt}`;
}

/**
 * `@RabbitSubscribe` options. A throwing handler is retried with exponential backoff
 * (1, 2, 4, 8, 16 s by default, capped at 60 s) through `<queue>.retry.N`, which dead-letter
 * back to `<queue>` only. Once the retries are used up the message is nacked to `<queue>.dlq`.
 */
function deadLetterQueue(queue: string, policy: Required<RetryOptions>) {
	return {
		queue: queue,
		queueOptions: {
			durable: true as const,
			deadLetterExchange: DEAD_LETTER_EXCHANGE,
			deadLetterRoutingKey: queue,
		},
		// Overrides `errorBehavior`.
		errorHandler: consumerFailureHandler(queue, policy),
	};
}

type Counter = ReturnType<ReturnType<typeof getMeter>['createCounter']>;

let failureCounter: Counter | undefined;

function consumerFailureCounter(): Counter {
	failureCounter ??= getMeter().createCounter('consumer_failures_total', {
		description: 'Messages whose consumer handler threw (each is retried or dead-lettered)',
	});
	return failureCounter;
}

function isConfirmChannel(channel: Channel): channel is ConfirmChannel {
	return typeof (channel as Partial<ConfirmChannel>).waitForConfirms === 'function';
}

/** Headers RabbitMQ adds on dead-lettering; dropped so they do not pile up across retries. */
const DEATH_HEADERS = /^x-(death|first-death-|last-death-)/;

function retryPublishOptions(msg: ConsumeMessage, attempt: number): PublishOptions {
	const p = msg.properties;
	const headers: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(p.headers ?? {})) {
		if (!DEATH_HEADERS.test(key)) headers[key] = value;
	}
	headers[RETRY_COUNT_HEADER] = attempt;
	const options: PublishOptions = { persistent: true, headers: headers };
	// Keep the original properties. `expiration` and `userId` are left out on purpose: the delay
	// comes from the retry queue's TTL, and the broker rejects a userId that is not ours.
	const copy = {
		contentType: p.contentType as string | undefined,
		contentEncoding: p.contentEncoding as string | undefined,
		priority: p.priority as number | undefined,
		correlationId: p.correlationId as string | undefined,
		replyTo: p.replyTo as string | undefined,
		messageId: p.messageId as string | undefined,
		timestamp: p.timestamp as number | undefined,
		type: p.type as string | undefined,
		appId: p.appId as string | undefined,
	};
	for (const [key, value] of Object.entries(copy)) {
		if (value !== undefined && value !== null) (options as Record<string, unknown>)[key] = value;
	}
	return options;
}

/** Publishes to the default exchange; on a confirm channel, resolves only once the broker confirms. */
function publishToQueue(
	channel: Channel,
	queue: string,
	content: Buffer,
	options: PublishOptions,
): Promise<void> {
	if (!isConfirmChannel(channel)) {
		channel.publish('', queue, content, options);
		return Promise.resolve();
	}
	return new Promise<void>((resolve, reject) => {
		channel.publish('', queue, content, options, err => {
			if (err)
				reject(err instanceof Error ? err : new Error('Broker did not confirm the retry publish'));
			else resolve();
		});
	});
}

/** Pause before requeueing after a failed retry publish: 1-2 s (1 s plus up to 1 s of jitter). */
export const RETRY_PUBLISH_FAILURE_DELAY_MS = 1000;

function retryPublishFailureDelayMs(): number {
	return (
		RETRY_PUBLISH_FAILURE_DELAY_MS + Math.floor(Math.random() * RETRY_PUBLISH_FAILURE_DELAY_MS)
	);
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function retryCountOf(msg: ConsumeMessage): number {
	const raw: unknown = msg.properties.headers?.[RETRY_COUNT_HEADER];
	const n = typeof raw === 'number' ? raw : Number(raw);
	return Number.isInteger(n) && n > 0 ? n : 0;
}

function consumerFailureHandler(
	queue: string,
	policy: Required<RetryOptions>,
): MessageErrorHandler {
	const handleOne = async (channel: Channel, msg: ConsumeMessage) => {
		consumerFailureCounter().add(1, { consumer: queue });
		const retries = retryCountOf(msg);
		if (retries >= policy.maxAttempts) {
			channel.nack(msg, false, false); // -> eventbus.dlx -> <queue>.dlq
			return;
		}
		const attempt = retries + 1;
		try {
			// Default exchange straight into this consumer's own delay queue: never via eventbus,
			// so other subscribers of the same routing key don't get a duplicate.
			await publishToQueue(
				channel,
				retryQueueName(queue, attempt),
				msg.content,
				retryPublishOptions(msg, attempt),
			);
		} catch {
			// The retry copy may not exist; keep the original rather than lose it. Wait first: an
			// immediate requeue would redeliver, fail and republish again in a hot loop.
			await sleep(retryPublishFailureDelayMs());
			channel.nack(msg, false, true);
			return;
		}
		channel.ack(msg);
	};
	return async (channel, msg) => {
		const msgs = (Array.isArray(msg) ? msg : [msg]) as ConsumeMessage[];
		for (const m of msgs) await handleOne(channel, m);
	};
}

/** Declares `<queue>.dlq`, bound to the dead-letter exchange with routing key `<queue>`. */
export function dlqQueueConfig(queue: string): QueueConfig {
	return {
		name: `${queue}.dlq`,
		exchange: DEAD_LETTER_EXCHANGE,
		routingKey: queue,
		options: { durable: true },
	};
}

/**
 * Declares the delay queues `<queue>.retry.1..maxAttempts`. Each has a fixed TTL
 * (`min(base * 2^(n-1), max)`) and no consumer; expired messages dead-letter through the
 * default exchange back to `<queue>` only. One queue per attempt avoids head-of-line blocking
 * between short and long delays.
 */
function retryQueueConfigs(queue: string, policy: Required<RetryOptions>): QueueConfig[] {
	const { maxAttempts, baseDelayMs, maxDelayMs } = policy;
	return Array.from({ length: maxAttempts }, (_, n) => ({
		name: retryQueueName(queue, n + 1),
		options: {
			durable: true,
			messageTtl: Math.min(baseDelayMs * 2 ** n, maxDelayMs),
			deadLetterExchange: '',
			deadLetterRoutingKey: queue,
		},
	}));
}

export interface ConsumerQueue {
	/** Queue name; also the consumer's inbox name. */
	readonly name: string;
	/** Spread into `@RabbitSubscribe({...})`. */
	readonly subscribe: ReturnType<typeof deadLetterQueue>;
	/** Spread into the app's sub config `queues`: `<queue>.dlq` and `<queue>.retry.1..maxAttempts`. */
	readonly queues: QueueConfig[];
}

/**
 * The single definition of a retrying consumer queue. The subscribe options and the declared
 * retry queues come from the same retry policy, so they can't drift apart: a handler retrying
 * into a `<queue>.retry.N` that was never declared would publish to nowhere on the default
 * exchange, get confirmed, and be acked, losing the message.
 */
export function defineConsumerQueue(name: string, opts?: RetryOptions): ConsumerQueue {
	const policy = retryPolicy(opts);
	return {
		name: name,
		subscribe: deadLetterQueue(name, policy),
		queues: [dlqQueueConfig(name), ...retryQueueConfigs(name, policy)],
	};
}
