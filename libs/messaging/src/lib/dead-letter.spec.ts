import { deadLetterQueue, dlqQueueConfig } from './dead-letter';

describe('dead-letter helpers', () => {
	it('deadLetterQueue returns options binding <q>.dlq', () => {
		expect(deadLetterQueue('notification.events.badge.earned')).toEqual({
			queue: 'notification.events.badge.earned',
			queueOptions: {
				durable: true,
				deadLetterExchange: 'eventbus.dlx',
				deadLetterRoutingKey: 'notification.events.badge.earned',
			},
		});
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
