import { OWNERSHIP_QUEUES } from '../app/events/handlers/ownership-queues';
import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { defaultRmqExchanges } from '@server/utils';

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [...defaultRmqExchanges],
		queues: [
			...OWNERSHIP_QUEUES.examCreated.queues,
			...OWNERSHIP_QUEUES.examDeleted.queues,
			...OWNERSHIP_QUEUES.roomCreated.queues,
			...OWNERSHIP_QUEUES.roomDeleted.queues,
			...OWNERSHIP_QUEUES.resourceCreated.queues,
			...OWNERSHIP_QUEUES.resourceDeleted.queues,
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
