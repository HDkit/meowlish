import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'gateway' });
void import('./bootstrap.js');
