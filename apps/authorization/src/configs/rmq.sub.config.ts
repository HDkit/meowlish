import { OWNERSHIP_QUEUES } from '../app/events/handlers/ownership-queues';
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
			dlqQueueConfig(OWNERSHIP_QUEUES.examCreated),
			dlqQueueConfig(OWNERSHIP_QUEUES.examDeleted),
			dlqQueueConfig(OWNERSHIP_QUEUES.roomCreated),
			dlqQueueConfig(OWNERSHIP_QUEUES.roomDeleted),
			dlqQueueConfig(OWNERSHIP_QUEUES.resourceCreated),
			dlqQueueConfig(OWNERSHIP_QUEUES.resourceDeleted),
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
