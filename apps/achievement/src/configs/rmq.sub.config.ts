import { ATTEMPT_SCORED_QUEUE } from '../app/events/handlers/attempt-scored.handler';
import { ATTEMPT_SUBMITTED_QUEUE } from '../app/events/handlers/attempt-submitted.handler';
import { LOGIN_QUEUE } from '../app/events/handlers/login.handler';
import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { dlqQueueConfig } from '@server/messaging';
import { defaultRmqExchanges } from '@server/utils';

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [...defaultRmqExchanges],
		queues: [
			dlqQueueConfig(LOGIN_QUEUE),
			dlqQueueConfig(ATTEMPT_SUBMITTED_QUEUE),
			dlqQueueConfig(ATTEMPT_SCORED_QUEUE),
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
