import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'file-service' });
void import('./bootstrap.js');
