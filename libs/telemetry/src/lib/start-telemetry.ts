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

export interface StartTelemetryOptions {
	serviceName: string;
}

const METRIC_EXPORT_INTERVAL_MS = 15000;

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
				'@opentelemetry/instrumentation-winston': { disableLogSending: false },
			}),
		],
	});

	sdk.start();

	process.once('SIGTERM', () => {
		// A SIGTERM listener disables Node's default exit, so re-raise once the SDK has flushed.
		sdk
			.shutdown()
			.catch((error: unknown) => {
				console.error('Error shutting down telemetry', error);
			})
			.finally(() => {
				process.kill(process.pid, 'SIGTERM');
			});
	});

	return sdk;
}

export function getMeter(): Meter {
	return metrics.getMeter('meowlish');
}
