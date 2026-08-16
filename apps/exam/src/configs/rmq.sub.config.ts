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
				name: 'exam.dlx',
				type: 'topic',
				options: { durable: true },
			},
		],
		queues: [
			{
				exchange: 'exam.dlx',
				routingKey: 'writing.result.dlq',
				name: 'exam.writing.result.dlq',
			},
		],
		uri: `amqp://${rmqConfig.user}:${rmqConfig.password}@${rmqConfig.host}:${rmqConfig.port}`,
		connectionInitOptions: { wait: true },
		defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
	};
};
