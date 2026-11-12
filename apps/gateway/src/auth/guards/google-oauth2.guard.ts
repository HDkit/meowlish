import { AuthenticatedRequest } from '../../types/authenticated-request';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Claims } from '@server/utils';
import { Response } from 'express';
import Redis from 'ioredis';

export const OAUTH_STATE_COOKIE = 'oauth2_state';
export const OAUTH_STATE_TTL_SECONDS = 300;
export const oauthStateKey = (nonce: string) => `gateway:oauth2:state:${nonce}`;

@Injectable()
export class GoogleOAuth2Guard extends AuthGuard('google') {
	private readonly redis: Redis;
	constructor(private readonly redisService: RedisService) {
		super();
		this.redis = this.redisService.getOrThrow();
	}

	async getAuthenticateOptions(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest & { user?: Claims }>();
		if (!request.user) return { state: undefined };

		// Linking flow: the state is an opaque single-use nonce (the server adds the key prefix) and is
		// bound to this browser by a cookie, so a consent link can't be replayed by someone else.
		const nonce = crypto.randomUUID();
		await this.redis.set(oauthStateKey(nonce), request.user.sub, 'EX', OAUTH_STATE_TTL_SECONDS);
		const response = context.switchToHttp().getResponse<Response>();
		response.cookie(OAUTH_STATE_COOKIE, nonce, {
			httpOnly: true,
			sameSite: 'lax',
			secure: request.secure || request.headers['x-forwarded-proto'] === 'https',
			maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
			path: '/api/v1/auth/google/callback',
		});
		// `state` is passed by nestjs/passport's AuthGuard to passport.authenticate()
		// https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts
		return { state: nonce };
	}
}
