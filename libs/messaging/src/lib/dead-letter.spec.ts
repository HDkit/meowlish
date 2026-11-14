import { type ConsumerQueue, defineConsumerQueue, dlqQueueConfig } from './dead-letter';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

class TestReader extends MetricReader {
	protected onShutdown(): Promise<void> {
		return Promise.resolve();
	}
	protected onForceFlush(): Promise<void> {
		return Promise.resolve();
	}
}

type PublishCb = (err: unknown, ok?: unknown) => void;

/** A fake amqplib ConfirmChannel: `publish` confirms (or fails) through its callback. */
function fakeChannel(publishError?: Error) {
	const ack = jest.fn();
	const nack = jest.fn();
	const publish = jest.fn(
		(_ex: string, _rk: string, _content: Buffer, _opts: unknown, cb?: PublishCb) => {
			if (publishError) throw publishError;
			cb?.(null);
			return true;
		},
	);
	const waitForConfirms = jest.fn();
	const channel = {
		ack: ack,
		nack: nack,
		publish: publish,
		waitForConfirms: waitForConfirms,
	} as unknown as ConfirmChannel;
	return { channel: channel, ack: ack, nack: nack, publish: publish };
}

function message(retryCount?: number): ConsumeMessage {
	const headers: Record<string, unknown> = { 'x-trace': 'abc' };
	if (retryCount !== undefined) headers['x-retry-count'] = retryCount;
	return {
		content: Buffer.from('{"eventId":"e1"}'),
		fields: {
			deliveryTag: 1,
			redelivered: false,
			exchange: 'eventbus',
			routingKey: 'auth.user.login',
			consumerTag: 't',
		},
		properties: {
			contentType: 'application/json',
			contentEncoding: undefined,
			headers: { ...headers, 'x-death': [{ queue: 'q.retry.1' }] },
			deliveryMode: 2,
			priority: undefined,
			correlationId: 'corr-1',
			replyTo: undefined,
			expiration: undefined,
			messageId: 'msg-1',
			timestamp: 1700000000,
			type: 'auth.user.login',
			userId: undefined,
			appId: 'auth',
			clusterId: undefined,
		},
	} as ConsumeMessage;
}

const Q = 'achievement.events.user.login';
const handler = (queue = Q) => defineConsumerQueue(queue).subscribe.errorHandler;
const retryQueues = (q: ConsumerQueue) => q.queues.filter(c => c.name?.includes('.retry.'));

describe('dead-letter helpers', () => {
	// The failure counter is created once, on first use, so the provider must be set before any test.
	const reader = new TestReader();
	beforeAll(() => {
		metrics.disable();
		metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
	});
	afterAll(() => metrics.disable());

	it('subscribe options bind <q>.dlq', () => {
		expect(defineConsumerQueue('notification.events.badge.earned').subscribe).toEqual({
			queue: 'notification.events.badge.earned',
			queueOptions: {
				durable: true,
				deadLetterExchange: 'eventbus.dlx',
				deadLetterRoutingKey: 'notification.events.badge.earned',
			},
			errorHandler: expect.any(Function) as unknown,
		});
	});

	it('retries go only to the failing queue', async () => {
		const { channel, ack, nack, publish } = fakeChannel();
		const msg = message();

		await handler()(channel, msg, new Error('boom'));

		expect(publish).toHaveBeenCalledTimes(1);
		const [exchange, routingKey, content, options] = publish.mock.calls[0];
		expect(exchange).toBe('');
		expect(routingKey).toBe(`${Q}.retry.1`);
		expect(content).toBe(msg.content);
		expect(options).toEqual({
			persistent: true,
			contentType: 'application/json',
			correlationId: 'corr-1',
			messageId: 'msg-1',
			timestamp: 1700000000,
			type: 'auth.user.login',
			appId: 'auth',
			headers: { 'x-trace': 'abc', 'x-retry-count': 1 },
		});
		expect(ack).toHaveBeenCalledWith(msg);
		expect(nack).not.toHaveBeenCalled();

		// Each retry queue dead-letters back through the default exchange to <q> only.
		for (const retry of retryQueues(defineConsumerQueue(Q))) {
			expect(retry.exchange).toBeUndefined();
			expect(retry.options).toMatchObject({
				durable: true,
				deadLetterExchange: '',
				deadLetterRoutingKey: Q,
			});
		}
	});

	it('routes retry n to <q>.retry.(n+1)', async () => {
		for (let n = 0; n < 5; n++) {
			const { channel, publish } = fakeChannel();
			await handler()(channel, message(n), new Error('boom'));
			expect(publish.mock.calls[0][1]).toBe(`${Q}.retry.${n + 1}`);
			expect((publish.mock.calls[0][3] as { headers: object }).headers).toMatchObject({
				'x-retry-count': n + 1,
			});
		}
	});

	it('delays grow 1,2,4,8,16 s capped at 60 s', () => {
		const ttl = (q: ConsumerQueue) => retryQueues(q).map(c => [c.name, c.options?.messageTtl]);

		expect(ttl(defineConsumerQueue(Q))).toEqual([
			[`${Q}.retry.1`, 1000],
			[`${Q}.retry.2`, 2000],
			[`${Q}.retry.3`, 4000],
			[`${Q}.retry.4`, 8000],
			[`${Q}.retry.5`, 16000],
		]);
		expect(ttl(defineConsumerQueue(Q, { maxAttempts: 8 })).map(([, t]) => t)).toEqual([
			1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
		]);
	});

	it('dead-letters after max attempts', async () => {
		const { channel, ack, nack, publish } = fakeChannel();
		const msg = message(5);

		await handler()(channel, msg, new Error('boom'));

		expect(publish).not.toHaveBeenCalled();
		expect(ack).not.toHaveBeenCalled();
		expect(nack).toHaveBeenCalledWith(msg, false, false);
	});

	describe('when the retry publish fails', () => {
		beforeEach(() => jest.useFakeTimers());
		afterEach(() => jest.useRealTimers());

		it('waits at least 1 s, then nacks with requeue', async () => {
			const { channel, ack, nack } = fakeChannel(new Error('channel closed'));
			const msg = message(2);

			const done = handler()(channel, msg, new Error('boom'));
			await jest.advanceTimersByTimeAsync(999);
			expect(nack).not.toHaveBeenCalled(); // no hot redeliver loop

			await jest.advanceTimersByTimeAsync(1001);
			await done;
			expect(ack).not.toHaveBeenCalled();
			expect(nack).toHaveBeenCalledWith(msg, false, true);
		});

		it('adds jitter to the wait (1-2 s)', async () => {
			const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
			const { channel, nack } = fakeChannel(new Error('channel closed'));

			const done = handler()(channel, message(0), new Error('boom'));
			await jest.advanceTimersByTimeAsync(1499);
			expect(nack).not.toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(1);
			await done;
			expect(nack).toHaveBeenCalledTimes(1);
			random.mockRestore();
		});
	});

	it('republish not confirmed by the broker nacks with requeue', async () => {
		const { channel, ack, nack, publish } = fakeChannel();
		publish.mockImplementation((_e, _r, _c, _o, cb?: PublishCb) => {
			cb?.(new Error('nacked by broker'));
			return true;
		});
		const msg = message(0);

		jest.useFakeTimers();
		const done = handler()(channel, msg, new Error('boom'));
		await jest.advanceTimersByTimeAsync(2000);
		await done;
		jest.useRealTimers();

		expect(ack).not.toHaveBeenCalled();
		expect(nack).toHaveBeenCalledWith(msg, false, true);
	});

	it('counts consumer_failures_total on every failure', async () => {
		const errorHandler = handler('file.events.file.added');
		await errorHandler(fakeChannel().channel, message(0), new Error('boom'));
		await errorHandler(fakeChannel().channel, message(5), new Error('boom'));

		const { resourceMetrics } = await reader.collect();
		const metric = resourceMetrics.scopeMetrics
			.flatMap(s => s.metrics)
			.find(m => m.descriptor.name === 'consumer_failures_total');
		const points = metric?.dataPoints.filter(
			p => p.attributes['consumer'] === 'file.events.file.added',
		);
		expect(points?.map(p => ({ a: p.attributes, v: p.value }))).toEqual([
			{ a: { consumer: 'file.events.file.added' }, v: 2 },
		]);
	});

	it('dlqQueueConfig names the queue <q>.dlq and binds it to eventbus.dlx', () => {
		expect(dlqQueueConfig('notification.events.badge.earned')).toEqual({
			name: 'notification.events.badge.earned.dlq',
			exchange: 'eventbus.dlx',
			routingKey: 'notification.events.badge.earned',
			options: { durable: true },
		});
	});

	it('queues declares <q>.dlq and <q>.retry.1..5', () => {
		expect(defineConsumerQueue(Q).queues.map(q => q.name)).toEqual([
			`${Q}.dlq`,
			`${Q}.retry.1`,
			`${Q}.retry.2`,
			`${Q}.retry.3`,
			`${Q}.retry.4`,
			`${Q}.retry.5`,
		]);
	});

	it('declares exactly the retry queues its handler publishes to, whatever the options', async () => {
		for (const maxAttempts of [1, 3, 5, 8]) {
			const q = defineConsumerQueue(Q, { maxAttempts: maxAttempts });
			const declared = new Set(q.queues.map(c => c.name));
			for (let n = 0; n < maxAttempts; n++) {
				const { channel, publish } = fakeChannel();
				await q.subscribe.errorHandler(channel, message(n), new Error('boom'));
				expect(declared.has(publish.mock.calls[0][1])).toBe(true);
			}
			const { channel, nack, publish } = fakeChannel();
			const last = message(maxAttempts);
			await q.subscribe.errorHandler(channel, last, new Error('boom'));
			expect(publish).not.toHaveBeenCalled();
			expect(nack).toHaveBeenCalledWith(last, false, false);
		}
	});
});
