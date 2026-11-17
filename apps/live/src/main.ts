import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'live' });
void import('./bootstrap.js');
