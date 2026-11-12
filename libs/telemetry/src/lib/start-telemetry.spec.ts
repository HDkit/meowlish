import { startTelemetry } from './start-telemetry';
import { NodeSDK } from '@opentelemetry/sdk-node';

jest.mock('@opentelemetry/sdk-node');

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

	beforeEach(() => {
		MockedNodeSDK.mockClear();
	});

	afterEach(() => {
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
