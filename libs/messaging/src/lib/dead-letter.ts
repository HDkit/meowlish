import type { MessageHandlerOptions, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { getMeter } from '@server/telemetry';

export const DEAD_LETTER_EXCHANGE = 'eventbus.dlx';

type MessageErrorHandler = NonNullable<MessageHandlerOptions['errorHandler']>;
type QueueConfig = NonNullable<RabbitMQConfig['queues']>[number];

/** Spread into `@RabbitSubscribe({...})` so rejected messages route to `<queue>.dlq`. */
export function deadLetterQueue(queue: string) {
	return {
		queue: queue,
		queueOptions: {
			durable: true as const,
			deadLetterExchange: DEAD_LETTER_EXCHANGE,
			deadLetterRoutingKey: queue,
		},
		// Counts the failure, then NACKs without requeue (like golevelup's defaultNackErrorHandler)
		// so a throwing handler dead-letters instead of looping. Overrides `errorBehavior`.
		errorHandler: consumerFailureHandler(queue),
	};
}

function consumerFailureHandler(queue: string): MessageErrorHandler {
	return (channel, msg) => {
		getMeter()
			.createCounter('consumer_failures_total', {
				description: 'Messages whose consumer handler threw and were dead-lettered',
			})
			.add(1, { consumer: queue });
		channel.nack(msg, false, false);
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
