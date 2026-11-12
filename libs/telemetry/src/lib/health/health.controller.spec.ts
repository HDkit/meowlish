import { HealthModule } from './health.module';
import { ReadinessRegistry } from './readiness.registry';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { type INestApplication } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { type Server } from 'node:http';
import request from 'supertest';

const PRISMA = Symbol('PRISMA');

class TestReader extends MetricReader {
	protected onShutdown(): Promise<void> {
		return Promise.resolve();
	}
	protected onForceFlush(): Promise<void> {
		return Promise.resolve();
	}
}

interface HealthBody {
	status: string;
	info: Record<string, unknown>;
	error: Record<string, unknown>;
}

describe('HealthController', () => {
	let app: INestApplication;
	let registry: ReadinessRegistry;
	let reader: TestReader;

	const get = async (path: string, status: number): Promise<HealthBody> => {
		const res = await request(app.getHttpServer() as Server)
			.get(path)
			.expect(status);
		return res.body as HealthBody;
	};
	const prisma = { $queryRawUnsafe: jest.fn() };
	const connection = { connected: true };

	beforeEach(async () => {
		metrics.disable();
		reader = new TestReader();
		metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
		prisma.$queryRawUnsafe.mockReset().mockResolvedValue([{ '?column?': 1 }]);
		connection.connected = true;

		@Global()
		@Module({
			providers: [
				{ provide: PRISMA, useValue: prisma },
				{
					provide: AmqpConnectionManager,
					useValue: { getConnections: () => [connection] },
				},
			],
			exports: [PRISMA, AmqpConnectionManager],
		})
		class FakesModule {}

		const moduleRef = await Test.createTestingModule({
			imports: [
				FakesModule,
				HealthModule.forRoot({
					serviceName: 'test',
					prismaToken: PRISMA,
					rabbitmq: true,
					checkTimeoutMs: 50,
				}),
			],
		}).compile();
		app = moduleRef.createNestApplication();
		await app.init();
		registry = app.get(ReadinessRegistry);
	});

	afterEach(async () => {
		await app.close();
		metrics.disable();
	});

	it('live returns 200 ok', async () => {
		const body = await get('/health/live', 200);
		expect(body).toEqual({ status: 'ok' });
	});

	it('ready returns 200 when database, rabbitmq and registered checks pass', async () => {
		registry.register('authz-catchup', () => true);
		const body = await get('/health/ready', 200);
		expect(body.status).toBe('ok');
		expect(Object.keys(body.info)).toEqual(
			expect.arrayContaining(['database', 'rabbitmq', 'authz-catchup']),
		);
	});

	it('ready reports 503 while a RabbitMQ connection is down', async () => {
		connection.connected = false;
		const body = await get('/health/ready', 503);
		expect(body.error).toHaveProperty('rabbitmq');
		connection.connected = true;
		await get('/health/ready', 200);
	});

	it('ready reports 503 when the database ping fails', async () => {
		prisma.$queryRawUnsafe.mockRejectedValue(new Error('db down'));
		const body = await get('/health/ready', 503);
		expect(body.error).toHaveProperty('database');
	});

	it('ready reports 503 when a registered check returns false', async () => {
		registry.register('authz-catchup', () => false);
		const body = await get('/health/ready', 503);
		expect(body.error).toHaveProperty('authz-catchup');
	});

	it('ready treats a throwing check as down', async () => {
		registry.register('authz-catchup', () => {
			throw new Error('boom');
		});
		const body = await get('/health/ready', 503);
		expect(body.error).toHaveProperty('authz-catchup');
	});

	it('ready treats a hanging check as down', async () => {
		registry.register('authz-catchup', () => new Promise<boolean>(() => undefined));
		const body = await get('/health/ready', 503);
		expect(body.error).toHaveProperty('authz-catchup');
	});

	describe('service_ready gauge', () => {
		const readGauge = async (): Promise<{ value: number; service: unknown } | undefined> => {
			const { resourceMetrics } = await reader.collect();
			const metric = resourceMetrics.scopeMetrics
				.flatMap(scope => scope.metrics)
				.find(m => m.descriptor.name === 'service_ready');
			const point = metric?.dataPoints[0];
			return point ?
					{ value: point.value as number, service: point.attributes['service'] }
				:	undefined;
		};

		it('is 1 when all checks pass', async () => {
			expect(await readGauge()).toEqual({ value: 1, service: 'test' });
		});

		it('is 0 when a check fails, and recovers', async () => {
			connection.connected = false;
			expect(await readGauge()).toEqual({ value: 0, service: 'test' });
			connection.connected = true;
			expect(await readGauge()).toEqual({ value: 1, service: 'test' });
		});

		it('is 0 when evaluation throws', async () => {
			jest.spyOn(app.get(HealthCheckService), 'check').mockRejectedValue(new Error('kaboom'));
			expect(await readGauge()).toEqual({ value: 0, service: 'test' });
		});
	});
});
