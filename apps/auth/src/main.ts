import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'auth' });
void import('./bootstrap.js');
