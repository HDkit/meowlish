import { IsPublic } from '../auth/decorators/public.decorator';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NextFunction, Response } from 'express';
import { ClientRequest } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';

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
		on: {
			proxyReqWs: function (proxyReq: ClientRequest, req: AuthenticatedRequest) {
				try {
					let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
					if (!token) {
						const query = req.url?.split('?')[1];
						if (query) {
							token = new URLSearchParams(query).get('token');
						}
					}
					if (!token) throw Error('No token found');
					const secret = process.env.JWT_SECRET;
					if (!secret) throw Error('JWT_SECRET not configured');
					const payload = jwt.verify(token, secret) as { sub: string };
					proxyReq.setHeader('Authorization', payload.sub);
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
