import { type AuthenticatedRequest } from '../types/authenticated-request';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { ClientRequest } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ExtractJwt } from 'passport-jwt';

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
		on: {
			proxyReqWs: function (proxyReq: ClientRequest, req: AuthenticatedRequest) {
				try {
					const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
					if (!token) throw Error('Error while getting bearer token when upgrading to websocket');
					const payload = token.split('.')[1];
					const user = JSON.parse(Buffer.from(payload, 'base64url').toString()) as typeof req.user;
					proxyReq.setHeader('Authorization', user.sub);
				} catch (e) {
					console.error(e);
				}
			},
		},
	});

	@All()
	@ApiOperation({
		summary: 'Proxy to Live service',
		description: 'Handles WebSocket upgrade and proxies requests to Live service Socket.IO server.',
	})
	async get(@Req() req: AuthenticatedRequest, @Res() res: Response, @Next() next: NextFunction) {
		await this.proxy(req, res, next);
	}
}
