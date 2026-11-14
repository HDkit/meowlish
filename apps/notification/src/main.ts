import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'notification' });
void import('./bootstrap.js');
