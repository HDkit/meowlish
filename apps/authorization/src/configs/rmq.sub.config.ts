import { OWNERSHIP_QUEUES } from '../app/events/handlers/ownership-queues';
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
			...consumerQueueConfigs(OWNERSHIP_QUEUES.examCreated),
			...consumerQueueConfigs(OWNERSHIP_QUEUES.examDeleted),
			...consumerQueueConfigs(OWNERSHIP_QUEUES.roomCreated),
			...consumerQueueConfigs(OWNERSHIP_QUEUES.roomDeleted),
			...consumerQueueConfigs(OWNERSHIP_QUEUES.resourceCreated),
			...consumerQueueConfigs(OWNERSHIP_QUEUES.resourceDeleted),
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
