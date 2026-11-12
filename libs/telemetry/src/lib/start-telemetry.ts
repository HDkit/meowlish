import { type Meter, metrics } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import '@opentelemetry/winston-transport';

export interface StartTelemetryOptions {
	serviceName: string;
}

const METRIC_EXPORT_INTERVAL_MS = 15000;
const SHUTDOWN_TIMEOUT_MS = 5000;

const isHealthRequest = (req: { url?: string }): boolean =>
	req.url?.startsWith('/health/') ?? false;

export function startTelemetry(options: StartTelemetryOptions): NodeSDK | undefined {
	if (process.env['OTEL_SDK_DISABLED'] === 'true') {
		return undefined;
	}

	const sdk = new NodeSDK({
		resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: options.serviceName }),
		traceExporter: new OTLPTraceExporter(),
		metricReaders: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter(),
				exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
			}),
		],
		logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': { enabled: false },
				'@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: isHealthRequest },
				'@opentelemetry/instrumentation-winston': { disableLogSending: false },
			}),
		],
	});

	sdk.start();

	process.once('SIGTERM', () => {
		// A SIGTERM listener disables Node's default exit, so re-raise once the SDK has flushed.
		// Shutdown is bounded so a hung exporter cannot keep the process alive until SIGKILL.
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<void>(resolve => {
			timer = setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
		});
		Promise.race([sdk.shutdown(), timeout])
			.catch((error: unknown) => {
				console.error('Error shutting down telemetry', error);
			})
			.finally(() => {
				clearTimeout(timer);
				process.kill(process.pid, 'SIGTERM');
			});
	});

	return sdk;
}

export function getMeter(): Meter {
	return metrics.getMeter('meowlish');
}
