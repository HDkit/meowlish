import {
	GOOGLE_CALLBACK_PATH,
	type GoogleOAuthFrontend,
	resolveGoogleOAuthFrontend,
} from '../../auth-gateway/google-oauth-frontends';
import { IEnvVars } from '../../configs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import {
	BadRequestException,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Claims } from '@server/utils';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { z } from 'zod/v4';

export const OAUTH_STATE_COOKIE = 'oauth2_state';
export const OAUTH_STATE_TTL_SECONDS = 300;
export const oauthStateKey = (nonce: string) => `gateway:oauth2:state:${nonce}`;

/** What the OAuth state nonce points to in Redis. */
const stateRecordSchema = z.object({
	/** Linking flow: the identity that gets the Google credential. */
	identityId: z.string().optional(),
	/** Non-default frontend origin the flow started on. */
	frontend: z.string().optional(),
});
type StateRecord = z.infer<typeof stateRecordSchema>;

/** The flow a callback belongs to, resolved by the guard before the strategy runs. */
export interface GoogleOAuthFlow {
	identityId?: string;
	frontend: GoogleOAuthFrontend;
}

export interface GoogleOAuthRequest extends Request {
	user?: Claims;
	googleOAuth?: GoogleOAuthFlow;
}

/** undefined for a missing, malformed or pre-JSON (bare identity id) record. */
const parseStateRecord = (raw: string | null): StateRecord | undefined => {
	if (!raw) return undefined;
	try {
		const parsed = stateRecordSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
};

const readCookie = (req: Request, name: string): string | undefined =>
	req.headers.cookie
		?.split(';')
		.map(part => part.trim().split('='))
		.find(([key]) => key === name)?.[1];

@Injectable()
abstract class GoogleOAuth2BaseGuard extends AuthGuard('google') {
	protected readonly redis: Redis;
	constructor(
		private readonly redisService: RedisService,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		super();
		this.redis = this.redisService.getOrThrow();
	}

	protected get vps() {
		return this.configService.getOrThrow('vps', { infer: true });
	}
}

// `state` and `callbackURL` are passed by nestjs/passport's AuthGuard to passport.authenticate()
// https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts. passport-oauth2 sends the
// callbackURL both to Google and in the code exchange, so the callback must repeat the one the
// flow started with: the start guard stores the frontend in the state, the callback guard reads it.

/** Starts a Google flow (login, or linking when the request is authenticated). */
@Injectable()
export class GoogleOAuth2Guard extends GoogleOAuth2BaseGuard {
	async getAuthenticateOptions(context: ExecutionContext) {
		const http = context.switchToHttp();
		return this.startFlow(http.getRequest<GoogleOAuthRequest>(), http.getResponse<Response>());
	}

	private async startFlow(request: GoogleOAuthRequest, response: Response) {
		const requested = request.query['frontend'];
		const frontend = resolveGoogleOAuthFrontend(
			this.vps,
			typeof requested === 'string' ? requested : undefined,
		);
		if (!frontend) throw new BadRequestException('Unknown frontend');

		const record: StateRecord = { identityId: request.user?.sub, frontend: frontend.origin };
		// Default-frontend login needs no state (unchanged behaviour).
		if (!record.identityId && !record.frontend) return { state: undefined };

		// The state is an opaque single-use nonce (the server adds the key prefix).
		const nonce = crypto.randomUUID();
		await this.redis.set(
			oauthStateKey(nonce),
			JSON.stringify(record),
			'EX',
			OAUTH_STATE_TTL_SECONDS,
		);
		if (record.identityId) {
			// Linking flow: bound to this browser by a cookie, so a consent link can't be replayed by
			// someone else. The cookie lives on the frontend's host, which is why the callback must
			// come back through the same frontend.
			response.cookie(OAUTH_STATE_COOKIE, nonce, {
				httpOnly: true,
				sameSite: 'lax',
				secure: request.secure || request.headers['x-forwarded-proto'] === 'https',
				maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
				path: GOOGLE_CALLBACK_PATH,
			});
		}
		return { state: nonce, callbackURL: frontend.callbackUrl };
	}
}

/** Guards /google/callback: resolves the flow (`request.googleOAuth`) before the strategy runs. */
@Injectable()
export class GoogleOAuth2CallbackGuard extends GoogleOAuth2BaseGuard {
	async getAuthenticateOptions(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();
		const flow = await this.consumeState(request);
		request.googleOAuth = flow;
		return { callbackURL: flow.frontend.callbackUrl };
	}

	private async consumeState(request: GoogleOAuthRequest): Promise<GoogleOAuthFlow> {
		const state = request.query['state'];
		if (state === undefined) {
			// Default-frontend login never sends a state, and that never fails to resolve.
			const frontend = resolveGoogleOAuthFrontend(this.vps);
			if (!frontend) throw new UnauthorizedException('Expired session');
			return { frontend: frontend };
		}
		if (typeof state !== 'string') throw new UnauthorizedException('OAuth state mismatch');

		const record = parseStateRecord(await this.redis.get(oauthStateKey(state)));
		if (!record) throw new UnauthorizedException('Expired session');
		// Check the cookie before deleting, so someone else's request can't burn this state.
		if (record.identityId && readCookie(request, OAUTH_STATE_COOKIE) !== state) {
			throw new UnauthorizedException('OAuth state mismatch');
		}
		// DEL is the single-use gate: only one callback can consume the state.
		if ((await this.redis.del(oauthStateKey(state))) === 0) {
			throw new UnauthorizedException('Expired session');
		}
		const frontend = resolveGoogleOAuthFrontend(this.vps, record.frontend);
		// The frontend was removed from GOOGLE_OAUTH_FRONTENDS while this flow was in progress.
		if (!frontend) throw new UnauthorizedException('Expired session');
		return { identityId: record.identityId, frontend: frontend };
	}
}
