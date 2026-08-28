import { RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';

type ExchangeType = NonNullable<RabbitMQConfig['exchanges']>[number];
type QueueType = NonNullable<RabbitMQConfig['queues']>[number];

export interface RetryQueueOptions {
	serviceName: string;
	queueName: string;
	mainExchange: string;
	mainRoutingKey: string;
	delays: number[];
}

export const RETRY_COUNT_HEADER = 'x-retry-count';

export function buildRetryExchange(serviceName: string): ExchangeType {
	return {
		name: `${serviceName}.retry`,
		type: 'direct',
		options: { durable: true },
	};
}

export function buildRetryQueues(config: RetryQueueOptions): QueueType[] {
	return config.delays.map((delay, index) => ({
		name: `${config.serviceName}.retry.${config.queueName}.${index + 1}`,
		exchange: `${config.serviceName}.retry`,
		routingKey: `${config.queueName}.${index + 1}`,
		options: {
			durable: true,
			messageTtl: delay,
			deadLetterExchange: config.mainExchange,
			deadLetterRoutingKey: config.mainRoutingKey,
		},
	}));
}

export function getRetryRoutingKey(queueName: string, retryCount: number): string {
	return `${queueName}.${retryCount + 1}`;
}
