import { config } from './config';

describe('config', () => {
	const saved = { ...process.env };
	beforeEach(() => {
		process.env.NODE_ENV = 'development';
		process.env.RMQ_HOST = 'h';
		process.env.RMQ_PORT = '5672';
		process.env.RMQ_USER = 'u';
		process.env.RMQ_PASS = 'p';
		delete process.env.MOCK_SCORER_MIN_DELAY_MS;
		delete process.env.MOCK_SCORER_MAX_DELAY_MS;
	});
	afterEach(() => {
		process.env = { ...saved };
	});

	it('defaults the delay to 1-3 minutes', () => {
		expect(config().scorer).toEqual({ minDelayMs: 60_000, maxDelayMs: 180_000 });
	});

	it('rejects min > max', () => {
		process.env.MOCK_SCORER_MIN_DELAY_MS = '200000';
		expect(() => config()).toThrow();
	});
});
