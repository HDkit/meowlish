import { ATTEMPT_SCORED_QUEUE } from '../app/events/handlers/attempt-scored.handler';
import { ATTEMPT_SUBMITTED_QUEUE } from '../app/events/handlers/attempt-submitted.handler';
import { LOGIN_QUEUE } from '../app/events/handlers/login.handler';
import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { consumerQueueConfigs } from '@server/messaging';
import { defaultRmqExchanges } from '@server/utils';

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [...defaultRmqExchanges],
		queues: [
			...consumerQueueConfigs(LOGIN_QUEUE),
			...consumerQueueConfigs(ATTEMPT_SUBMITTED_QUEUE),
			...consumerQueueConfigs(ATTEMPT_SCORED_QUEUE),
		],
		// One unacked message per consumer (basic.qos is per consumer): an instance works through
		// each queue serially, so the only version races left are across queues or instances, and
		// those are absorbed by the handlers' conflict retry plus the broker-level backoff retries.
		prefetchCount: 1,
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
