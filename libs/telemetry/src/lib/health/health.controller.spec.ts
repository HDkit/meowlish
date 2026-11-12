import { HealthModule } from './health.module';
import { ReadinessRegistry } from './readiness.registry';
import { AmqpConnectionManager } from '@golevelup/nestjs-rabbitmq';
import { type INestApplication } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';

const PRISMA = Symbol('PRISMA');

interface HealthBody {
	status: string;
	info: Record<string, unknown>;
	error: Record<string, unknown>;
}

describe('HealthController', () => {
	let app: INestApplication;
	let registry: ReadinessRegistry;

	const get = async (path: string, status: number): Promise<HealthBody> => {
		const res = await request(app.getHttpServer() as Server)
			.get(path)
			.expect(status);
		return res.body as HealthBody;
	};
	const prisma = { $queryRawUnsafe: jest.fn() };
	const connection = { connected: true };

	beforeEach(async () => {
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
				HealthModule.forRoot({ serviceName: 'test', prismaToken: PRISMA, rabbitmq: true }),
			],
		}).compile();
		app = moduleRef.createNestApplication();
		await app.init();
		registry = app.get(ReadinessRegistry);
	});

	afterEach(async () => {
		await app.close();
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
});
