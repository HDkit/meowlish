import { IsPublic } from '../auth/decorators/public.decorator';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

// The live service verifies the access token itself (socket.io `auth.token`, `?token=` or
// `Authorization: Bearer`), so this proxy forwards the handshake untouched.
@IsPublic()
@ApiBearerAuth()
@ApiTags('Live Service Websocket')
@Controller('socket.io')
export class LiveWsGatewayController {
	private proxy = createProxyMiddleware({
		target:
			process.env.LIVE_SERVICE_WS_URL ??
			`http://${process.env.LIVE_SERVICE_WS_HOST}:${process.env.LIVE_SERVICE_WS_PORT}`,
		changeOrigin: true,
		ws: true,
		pathRewrite: {
			'^.*\\/socket\\.io': '/socket.io',
		},
	});

	// long-polling and reconnects must not eat the API rate-limit bucket
	@All()
	@ApiOperation({
		summary: 'Proxy to Live service',
		description: 'Handles WebSocket upgrade and proxies requests to Live service Socket.IO server.',
	})
	@SkipThrottle()
	async get(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
		await this.proxy(req, res, next);
	}
}
