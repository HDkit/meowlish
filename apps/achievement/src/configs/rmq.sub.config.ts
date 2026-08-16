import { IEnvVars } from './config';
import { MessageHandlerErrorBehavior, RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import { defaultRmqExchanges } from '@server/utils';

export const rmqSubConfig = (configService: ConfigService<IEnvVars>): RabbitMQConfig => {
	const rmqConfig = configService.getOrThrow('messageQueue', { infer: true });
	return {
		name: 'sub',
		exchanges: [
			...defaultRmqExchanges,
			{
				name: 'achievement.dlx',
				type: 'topic',
				options: { durable: true },
			},
		],
		queues: [
			{
				exchange: 'achievement.dlx',
				routingKey: 'user.login.failed',
				name: 'achievement.events.user.login.dlq',
			},
			{
				exchange: 'achievement.dlx',
				routingKey: 'attempt.submitted.failed',
				name: 'achievement.events.attempt.submitted.dlq',
			},
			{
				exchange: 'achievement.dlx',
				routingKey: 'attempt.scored.failed',
				name: 'achievement.events.attempt.scored.dlq',
			},
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
