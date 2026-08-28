import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { buildRetryExchange, buildRetryQueues, defaultRmqExchanges } from '@server/utils';

export const WRITING_SCORED_RETRY_DELAYS = [5_000, 30_000, 120_000];
export const WRITING_SCORED_MAX_RETRIES = WRITING_SCORED_RETRY_DELAYS.length;
export const WRITING_SCORED_RETRY_QUEUE_NAME = 'writing-scored';

const writingScoredRetryQueues = buildRetryQueues({
	serviceName: 'exam',
	queueName: WRITING_SCORED_RETRY_QUEUE_NAME,
	mainExchange: 'eventbus',
	mainRoutingKey: 'exam.writing.scored',
	delays: WRITING_SCORED_RETRY_DELAYS,
});

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [
			...defaultRmqExchanges,
			{
				name: 'exam.dlx',
				type: 'topic',
				options: { durable: true },
			},
			buildRetryExchange('exam'),
		],
		queues: [
			{
				exchange: 'exam.dlx',
				routingKey: 'writing.result.dlq',
				name: 'exam.writing.result.dlq',
			},
			...writingScoredRetryQueues,
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
