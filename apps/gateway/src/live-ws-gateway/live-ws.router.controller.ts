import { IsPublic } from '../auth/decorators/public.decorator';
import { type IEnvVars } from '../configs/config';
import { SkipAllThrottlers } from '../throttle';
import { All, Controller, Next, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { type RequestHandler, createProxyMiddleware } from 'http-proxy-middleware';
import { type IncomingMessage } from 'node:http';
import { type Duplex } from 'node:stream';

// The live service verifies the access token itself (`access_token` cookie, socket.io
// `auth.token`, `?token=` or `Authorization: Bearer`), so this proxy forwards the handshake untouched.
@IsPublic()
@ApiBearerAuth()
@ApiTags('Live Service Websocket')
@Controller('socket.io')
export class LiveWsGatewayController {
	private readonly proxy: RequestHandler;

	constructor(configService: ConfigService<IEnvVars>) {
		const live = configService.getOrThrow('microservicesConnection.live', { infer: true });
		this.proxy = createProxyMiddleware({
			target: live.wsUrl ?? `http://${live.hostWs}:${live.portWs}`,
			changeOrigin: true,
			ws: true,
			// Live's engine.io matches its path by the strict prefix `/socket.io/`, so every form the
			// gateway receives (`…/socket.io?EIO=…`, `…/socket.io/?EIO=…`, upgrades) must reach it with
			// the slash. `[^?]*` keeps the match inside the path, never the query string.
			pathRewrite: {
				'^[^?]*/socket\\.io/?': '/socket.io/',
			},
		});
	}

	/**
	 * Proxies a WebSocket upgrade for the socket.io path. Subscribed to the HTTP server at start-up
	 * (`bootstrap.ts`): http-proxy-middleware only subscribes itself on the first normal request, so
	 * after a restart a websocket-only client timed out until a polling request came through. Once
	 * the library has subscribed, its `upgrade` steps aside, so nothing is handled twice.
	 */
	readonly handleUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
		if (!req.url?.includes('/socket.io')) return;
		this.proxy.upgrade(req, socket as never, head);
	};

	// long-polling and reconnects must not eat the API rate-limit bucket
	@All()
	@ApiOperation({
		summary: 'Proxy to Live service',
		description: 'Handles WebSocket upgrade and proxies requests to Live service Socket.IO server.',
	})
	@SkipAllThrottlers()
	async get(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
		await this.proxy(req, res, next);
	}
}
