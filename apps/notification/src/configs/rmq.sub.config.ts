import { ACHIEVEMENT_EARNED_QUEUE } from '../app/events/handlers/achievement-earned.handler';
import { REPORT_STATUS_CHANGED_QUEUE } from '../app/events/handlers/report-status-changed.handler';
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
		queues: [dlqQueueConfig(ACHIEVEMENT_EARNED_QUEUE), dlqQueueConfig(REPORT_STATUS_CHANGED_QUEUE)],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
