import { ATTEMPT_SCORED_QUEUE } from '../app/events/handlers/attempt-scored.handler';
import { ATTEMPT_SUBMITTED_QUEUE } from '../app/events/handlers/attempt-submitted.handler';
import { LOGIN_QUEUE } from '../app/events/handlers/login.handler';
import { rmqSubConfig } from './rmq.sub.config';

describe('rmqSubConfig', () => {
	const configService = {
		getOrThrow: jest.fn().mockReturnValue({ user: 'u', password: 'p', host: 'h', port: 5672 }),
	};
	const config = rmqSubConfig(configService as never);

	it('lets each consumer hold one unacked message at a time (prefetch 1)', () => {
		// Every achievement consumer uses the default channel, whose prefetch is this value.
		expect(config.prefetchCount).toBe(1);
		expect(config.channels).toBeUndefined();
	});

	it('declares the retry and dead-letter queues of every consumer', () => {
		const names = (config.queues ?? []).map(q => q.name);
		for (const { name: queue } of [LOGIN_QUEUE, ATTEMPT_SUBMITTED_QUEUE, ATTEMPT_SCORED_QUEUE]) {
			expect(names).toContain(`${queue}.dlq`);
			expect(names).toContain(`${queue}.retry.5`);
		}
	});
});
