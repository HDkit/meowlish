import { RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';

type ExchangesType = NonNullable<RabbitMQConfig['exchanges']>;

export const defaultRmqExchanges: ExchangesType = [
	{
		name: 'eventbus',
		type: 'topic',
		options: { durable: true },
	},
	{
		name: 'eventbus.dlx',
		type: 'topic',
		options: { durable: true },
	},
];
