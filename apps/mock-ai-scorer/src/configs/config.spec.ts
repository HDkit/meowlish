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

	it('defaults the delay to 2000-8000 ms', () => {
		expect(config().scorer).toEqual({ minDelayMs: 2000, maxDelayMs: 8000 });
	});

	it('rejects min > max', () => {
		process.env.MOCK_SCORER_MIN_DELAY_MS = '9000';
		expect(() => config()).toThrow();
	});
});
