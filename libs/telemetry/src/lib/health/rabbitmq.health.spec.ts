import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { HealthIndicatorService, TerminusModule } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';

const connection = { connected: true };

// Not global and not imported by the indicator's module: only reachable via strict:false.
@Module({
	providers: [{ provide: AmqpConnectionManager, useValue: { getConnections: () => [connection] } }],
	exports: [AmqpConnectionManager],
})
class SiblingRabbitModule {}

@Module({ imports: [TerminusModule], providers: [RabbitMqHealthIndicator] })
class IndicatorModule {}

describe('RabbitMqHealthIndicator', () => {
	const build = async (withSibling: boolean): Promise<RabbitMqHealthIndicator> => {
		const moduleRef = await Test.createTestingModule({
			imports: withSibling ? [SiblingRabbitModule, IndicatorModule] : [IndicatorModule],
		}).compile();
		await moduleRef.init();
		expect(moduleRef.get(HealthIndicatorService, { strict: false })).toBeDefined();
		return moduleRef.get(RabbitMqHealthIndicator, { strict: false });
	};

	beforeEach(() => {
		connection.connected = true;
	});

	it('resolves a manager provided by a sibling module (strict: false)', async () => {
		const indicator = await build(true);
		expect(indicator.check('rabbitmq')).toEqual({ rabbitmq: { status: 'up' } });
		connection.connected = false;
		expect(indicator.check('rabbitmq')['rabbitmq'].status).toBe('down');
	});

	it('fails closed when no manager is resolvable', async () => {
		const indicator = await build(false);
		expect(indicator.check('rabbitmq')['rabbitmq'].status).toBe('down');
	});
});
