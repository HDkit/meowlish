import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { defineConsumerQueue } from '@server/messaging';
import { defaultRmqExchanges } from '@server/utils';

/** Written by the external AI scorer; retried with backoff, then dead-lettered to `<q>.dlq`. */
export const WRITING_SCORED_QUEUE = defineConsumerQueue('exam.events.writing.scored');

/** exam's own `exam.attempt.submitted`: scoring runs here, through the inbox (durable). */
export const ATTEMPT_SUBMITTED_QUEUE = defineConsumerQueue('exam.events.attempt.submitted');

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [...defaultRmqExchanges],
		queues: [...WRITING_SCORED_QUEUE.queues, ...ATTEMPT_SUBMITTED_QUEUE.queues],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
