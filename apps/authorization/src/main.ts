import { startTelemetry } from '@server/telemetry';

startTelemetry({ serviceName: 'authorization' });
void import('./bootstrap.js');
