import { LiveWsGatewayController } from './live-ws.router.controller';
import { Module } from '@nestjs/common';

@Module({
	controllers: [LiveWsGatewayController],
})
export class LiveWsGatewayModule {}
