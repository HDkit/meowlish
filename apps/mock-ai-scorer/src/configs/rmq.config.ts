import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { defineConsumerQueue } from '@server/messaging';
import { defaultRmqExchanges } from '@server/utils';

/** Bare `exam.writing.submitted` events; retried with backoff, then dead-lettered to `<q>.dlq`. */
export const WRITING_SUBMITTED_QUEUE = defineConsumerQueue('mock-ai-scorer.writing.submitted');

/** Messages in flight at once; each one sleeps for its random delay before it is acked. */
export const PREFETCH_COUNT = 10;

export const rmqConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const mq = configService.getOrThrow('messageQueue', { infer: true });
	return {
		exchanges: [...defaultRmqExchanges],
		queues: [...WRITING_SUBMITTED_QUEUE.queues],
		uri: `amqp://${mq.user}:${mq.password}@${mq.host}:${mq.port}`,
		prefetchCount: PREFETCH_COUNT,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
