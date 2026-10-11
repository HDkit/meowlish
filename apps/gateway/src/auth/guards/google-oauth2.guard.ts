import { AuthenticatedRequest } from '../../types/authenticated-request';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Claims } from '@server/utils';
import Redis from 'ioredis';

@Injectable()
export class GoogleOAuth2Guard extends AuthGuard('google') {
	private readonly redis: Redis;
	constructor(private readonly redisService: RedisService) {
		super();
		this.redis = this.redisService.getOrThrow();
	}

	async getAuthenticateOptions(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest & { user?: Claims }>();
		const stateKey = request.user && `gateway:oauth2:state:${crypto.randomUUID()}`;
		if (stateKey) {
			await this.redis.set(stateKey, request.user.sub, 'EX', 300);
		}
		// the `state` is one of the option key that's very hard to find document for when using passport-google-oauth20
		// and the guard method getAuthenticateOptions of nestjs passport will pass the returned state to be used in canActivate()
		// which is passed to passport.authenticate() function
		// https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts
		return {
			state: stateKey,
		};
	}
}
