import { deadLetterQueue, dlqQueueConfig } from './dead-letter';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import type { Channel, ConsumeMessage } from 'amqplib';

class TestReader extends MetricReader {
	protected onShutdown(): Promise<void> {
		return Promise.resolve();
	}
	protected onForceFlush(): Promise<void> {
		return Promise.resolve();
	}
}

describe('dead-letter helpers', () => {
	it('deadLetterQueue returns options binding <q>.dlq', () => {
		expect(deadLetterQueue('notification.events.badge.earned')).toEqual({
			queue: 'notification.events.badge.earned',
			queueOptions: {
				durable: true,
				deadLetterExchange: 'eventbus.dlx',
				deadLetterRoutingKey: 'notification.events.badge.earned',
			},
			errorHandler: expect.any(Function) as unknown,
		});
	});

	it('errorHandler counts consumer_failures_total and nacks without requeue', async () => {
		const reader = new TestReader();
		metrics.disable();
		metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
		const nack = jest.fn();
		const channel = { nack: nack } as unknown as Channel;
		const msg = {} as ConsumeMessage;

		const { errorHandler } = deadLetterQueue('file.events.file.added');
		await errorHandler(channel, msg, new Error('boom'));

		expect(nack).toHaveBeenCalledWith(msg, false, false);
		const { resourceMetrics } = await reader.collect();
		const metric = resourceMetrics.scopeMetrics
			.flatMap(s => s.metrics)
			.find(m => m.descriptor.name === 'consumer_failures_total');
		expect(metric?.dataPoints.map(p => ({ a: p.attributes, v: p.value }))).toEqual([
			{ a: { consumer: 'file.events.file.added' }, v: 1 },
		]);
		metrics.disable();
	});

	it('dlqQueueConfig names the queue <q>.dlq and binds it to eventbus.dlx', () => {
		expect(dlqQueueConfig('notification.events.badge.earned')).toEqual({
			name: 'notification.events.badge.earned.dlq',
			exchange: 'eventbus.dlx',
			routingKey: 'notification.events.badge.earned',
			options: { durable: true },
		});
	});
});
