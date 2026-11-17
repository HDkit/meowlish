import { RedisThrottlerStorage } from '../throttle-storage';
import { type ConfigService } from '@nestjs/config';
import { type AppLoggerService } from '@server/logger';

const evalMock = jest.fn();
jest.mock('ioredis', () =>
	jest.fn().mockImplementation(() => ({
		eval: evalMock,
		on: jest.fn(),
		disconnect: jest.fn(),
	})),
);

describe('RedisThrottlerStorage', () => {
	const config = {
		getOrThrow: () => ({ host: 'localhost', port: 6379 }),
	} as unknown as ConfigService;
	const logger = { log: jest.fn(), warn: jest.fn() };
	let storage: RedisThrottlerStorage;

	beforeEach(() => {
		evalMock.mockReset();
		logger.log.mockReset();
		logger.warn.mockReset();
		storage = new RedisThrottlerStorage(config, logger as unknown as AppLoggerService);
	});

	afterEach(() => storage.onModuleDestroy());

	it('returns the shared counter from Redis, in seconds', async () => {
		evalMock.mockResolvedValue([3, 41_200, 0, 0]);
		await expect(storage.increment('k', 60_000, 10, 60_000, 'default')).resolves.toEqual({
			totalHits: 3,
			timeToExpire: 42,
			isBlocked: false,
			timeToBlockExpire: 0,
		});
		expect(evalMock).toHaveBeenCalledWith(
			expect.any(String),
			2,
			'throttle:k:hits',
			'throttle:k:block',
			60_000,
			10,
			60_000,
		);
	});

	it('reports a block', async () => {
		evalMock.mockResolvedValue([11, 60_000, 1, 60_000]);
		const record = await storage.increment('k', 60_000, 10, 60_000, 'default');
		expect(record.isBlocked).toBe(true);
		expect(record.timeToBlockExpire).toBe(60);
	});

	it('counts in memory while Redis is down, and warns once', async () => {
		evalMock.mockRejectedValue(new Error('Connection is closed.'));
		for (let i = 0; i < 3; i++) await storage.increment('k', 60_000, 2, 60_000, 'default');
		const record = await storage.increment('k', 60_000, 2, 60_000, 'default');
		expect(record.isBlocked).toBe(true);
		expect(logger.warn).toHaveBeenCalledTimes(1);
	});

	it('goes back to Redis when it recovers', async () => {
		evalMock.mockRejectedValueOnce(new Error('down')).mockResolvedValue([1, 60_000, 0, 0]);
		await storage.increment('k', 60_000, 10, 60_000, 'default');
		const record = await storage.increment('k', 60_000, 10, 60_000, 'default');
		expect(record.totalHits).toBe(1);
		expect(logger.log).toHaveBeenCalledWith('Rate limiting is back on Redis');
	});
});
