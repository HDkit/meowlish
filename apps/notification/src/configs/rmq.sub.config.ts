import { ACHIEVEMENT_EARNED_QUEUE } from '../app/events/handlers/achievement-earned.handler';
import { FLASHCARD_PROPOSAL_CREATED_QUEUE } from '../app/events/handlers/flashcard-proposal-created.handler';
import { FLASHCARD_PROPOSAL_DECIDED_QUEUE } from '../app/events/handlers/flashcard-proposal-decided.handler';
import { REPORT_CREATED_QUEUE } from '../app/events/handlers/report-created.handler';
import { REPORT_STATUS_CHANGED_QUEUE } from '../app/events/handlers/report-status-changed.handler';
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
			...ACHIEVEMENT_EARNED_QUEUE.queues,
			...FLASHCARD_PROPOSAL_CREATED_QUEUE.queues,
			...FLASHCARD_PROPOSAL_DECIDED_QUEUE.queues,
			...REPORT_CREATED_QUEUE.queues,
			...REPORT_STATUS_CHANGED_QUEUE.queues,
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
