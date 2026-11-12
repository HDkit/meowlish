import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { consumerQueueConfigs } from '@server/messaging';
import { defaultRmqExchanges } from '@server/utils';

/** Written by the external AI scorer; retried with backoff, then dead-lettered to `<q>.dlq`. */
export const WRITING_SCORED_QUEUE = 'exam.events.writing.scored';

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [...defaultRmqExchanges],
		queues: [...consumerQueueConfigs(WRITING_SCORED_QUEUE)],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
