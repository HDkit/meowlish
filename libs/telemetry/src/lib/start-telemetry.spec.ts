import { startTelemetry } from './start-telemetry';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

jest.mock('@opentelemetry/sdk-node');
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
	getNodeAutoInstrumentations: jest.fn(() => []),
}));

const MockedNodeSDK = jest.mocked(NodeSDK);

describe('startTelemetry', () => {
	const savedEnv = {
		OTEL_SDK_DISABLED: process.env['OTEL_SDK_DISABLED'],
		OTEL_EXPORTER_OTLP_ENDPOINT: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
	};

	const restore = (key: keyof typeof savedEnv): void => {
		if (savedEnv[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = savedEnv[key];
		}
	};

	const initialSigtermListeners = process.listeners('SIGTERM');

	const removeAddedSigtermListeners = (): void => {
		process.listeners('SIGTERM').forEach(listener => {
			if (!initialSigtermListeners.includes(listener)) {
				process.removeListener('SIGTERM', listener);
			}
		});
	};

	beforeEach(() => {
		MockedNodeSDK.mockClear();
	});

	afterEach(() => {
		removeAddedSigtermListeners();
		restore('OTEL_SDK_DISABLED');
		restore('OTEL_EXPORTER_OTLP_ENDPOINT');
	});

	it('returns undefined when OTEL_SDK_DISABLED is true', () => {
		process.env['OTEL_SDK_DISABLED'] = 'true';

		expect(startTelemetry({ serviceName: 'exam' })).toBeUndefined();
		expect(MockedNodeSDK).not.toHaveBeenCalled();
	});

	it('starts an SDK named after the service', () => {
		delete process.env['OTEL_SDK_DISABLED'];

		const sdk = startTelemetry({ serviceName: 'exam' });

		expect(sdk).toBeDefined();
		expect(MockedNodeSDK).toHaveBeenCalledTimes(1);
		const options = MockedNodeSDK.mock.calls[0][0];
		expect(options?.resource?.attributes['service.name']).toBe('exam');
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(MockedNodeSDK.mock.instances[0].start).toHaveBeenCalledTimes(1);
	});

	it('re-raises SIGTERM after shutting the SDK down', async () => {
		delete process.env['OTEL_SDK_DISABLED'];
		removeAddedSigtermListeners();
		const before = process.listeners('SIGTERM');
		const order: string[] = [];
		const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
			order.push('kill');
			return true;
		});
		let shutdownPromise: Promise<void> | undefined;
		MockedNodeSDK.mockImplementationOnce(
			() =>
				({
					start: jest.fn(),
					shutdown: jest.fn(() => {
						order.push('shutdown');
						shutdownPromise = Promise.resolve();
						return shutdownPromise;
					}),
				}) as unknown as NodeSDK,
		);

		try {
			startTelemetry({ serviceName: 'x' });
			process.emit('SIGTERM');
			await shutdownPromise;
			await new Promise(resolve => setImmediate(resolve));

			expect(order).toEqual(['shutdown', 'kill']);
			expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
			expect(process.listeners('SIGTERM')).toEqual(before);
		} finally {
			killSpy.mockRestore();
		}
	});

	it('re-raises SIGTERM even if shutdown hangs', async () => {
		jest.useFakeTimers();
		delete process.env['OTEL_SDK_DISABLED'];
		removeAddedSigtermListeners();
		const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
		MockedNodeSDK.mockImplementationOnce(
			() =>
				({
					start: jest.fn(),
					shutdown: jest.fn(() => new Promise<void>(() => undefined)),
				}) as unknown as NodeSDK,
		);

		try {
			startTelemetry({ serviceName: 'x' });
			process.emit('SIGTERM');
			await jest.advanceTimersByTimeAsync(4999);
			expect(killSpy).not.toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(1);
			expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
		} finally {
			killSpy.mockRestore();
			jest.useRealTimers();
		}
	});

	it('excludes /health/* requests from HTTP instrumentation', () => {
		delete process.env['OTEL_SDK_DISABLED'];

		startTelemetry({ serviceName: 'x' });

		const config = jest.mocked(getNodeAutoInstrumentations).mock.calls.at(-1)?.[0];
		const hook = config?.['@opentelemetry/instrumentation-http']?.ignoreIncomingRequestHook;
		expect(hook?.({ url: '/health/ready' } as never)).toBe(true);
		expect(hook?.({ url: '/api/v1/blogs' } as never)).toBe(false);
	});

	it('does not throw when the collector is unreachable', async () => {
		delete process.env['OTEL_SDK_DISABLED'];
		process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://127.0.0.1:1';
		const actual =
			jest.requireActual<typeof import('@opentelemetry/sdk-node')>('@opentelemetry/sdk-node');
		MockedNodeSDK.mockImplementationOnce((...args) => new actual.NodeSDK(...args));

		let sdk: NodeSDK | undefined;
		expect(() => {
			sdk = startTelemetry({ serviceName: 'x' });
		}).not.toThrow();

		await sdk?.shutdown();
	});
});
