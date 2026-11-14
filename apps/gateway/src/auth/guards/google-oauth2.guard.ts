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
import { CookieOptions, Request, Response } from 'express';
import Redis from 'ioredis';
import { z } from 'zod/v4';

export const OAUTH_STATE_COOKIE = 'oauth2_state';
export const OAUTH_STATE_TTL_SECONDS = 300;
export const oauthStateKey = (nonce: string) => `gateway:oauth2:state:${nonce}`;

/**
 * Transition for flows started before every flow carried a browser-bound state: until this
 * moment, a callback without a state (old default-frontend login) or with a state that predates
 * the cookie (old listed-frontend login) is still accepted. A Google flow lasts minutes (the state
 * itself expires after OAUTH_STATE_TTL_SECONDS), so a few hours past the deploy (2026-11-14
 * evening UTC) cover any flow in progress at it. A fixed date, not "since start", so a later
 * restart doesn't reopen it. Remove this and its two uses in the next release.
 */
export const LEGACY_STATE_ACCEPTED_UNTIL = Date.parse('2026-11-15T06:00:00Z');
const acceptsLegacyState = () => Date.now() < LEGACY_STATE_ACCEPTED_UNTIL;

/** What the OAuth state nonce points to in Redis. */
const stateRecordSchema = z.object({
	/** Linking flow: the identity that gets the Google credential. */
	identityId: z.string().optional(),
	/** Non-default frontend origin the flow started on. */
	frontend: z.string().optional(),
	/** Set on every state written since the transition: the `oauth2_state` cookie is required. */
	bound: z.boolean().optional(),
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

	/** Same `secure` rule as the session cookies (auth-cookies.ts). */
	protected stateCookieOptions(request: Request): CookieOptions {
		return {
			httpOnly: true,
			sameSite: 'lax',
			secure:
				request.secure ||
				request.headers['x-forwarded-proto'] === 'https' ||
				this.configService.getOrThrow('env', { infer: true }) === 'production',
			path: GOOGLE_CALLBACK_PATH,
		};
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

		const record: StateRecord = {
			identityId: request.user?.sub,
			frontend: frontend.origin,
			bound: true,
		};
		// Every flow (login too) gets an opaque single-use nonce bound to this browser by a cookie,
		// so a callback URL carrying someone else's code and state is refused (login CSRF), and a
		// consent link can't be replayed by someone else. The cookie lives on the frontend's host
		// (BASE_URL is the frontend's origin), which is why the callback must come back through the
		// frontend the flow started on. The server adds the key prefix.
		const nonce = crypto.randomUUID();
		await this.redis.set(
			oauthStateKey(nonce),
			JSON.stringify(record),
			'EX',
			OAUTH_STATE_TTL_SECONDS,
		);
		response.cookie(OAUTH_STATE_COOKIE, nonce, {
			...this.stateCookieOptions(request),
			maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
		});
		return { state: nonce, callbackURL: frontend.callbackUrl };
	}
}

/**
 * Guards /google/callback: resolves the flow (`request.googleOAuth`) before the strategy runs.
 * It is set as soon as the state is read, so GoogleOAuthCallbackFilter can redirect even a
 * rejected callback to the right frontend.
 */
@Injectable()
export class GoogleOAuth2CallbackGuard extends GoogleOAuth2BaseGuard {
	async getAuthenticateOptions(context: ExecutionContext) {
		const http = context.switchToHttp();
		const flow = await this.consumeState(
			http.getRequest<GoogleOAuthRequest>(),
			http.getResponse<Response>(),
		);
		return { callbackURL: flow.frontend.callbackUrl };
	}

	private async consumeState(
		request: GoogleOAuthRequest,
		response: Response,
	): Promise<GoogleOAuthFlow> {
		const state = request.query['state'];
		if (state === undefined) {
			// Only a default-frontend login started before the deploy has no state (transition).
			if (!acceptsLegacyState()) throw new UnauthorizedException('OAuth state missing');
			const frontend = resolveGoogleOAuthFrontend(this.vps);
			if (!frontend) throw new UnauthorizedException('Expired session');
			request.googleOAuth = { frontend: frontend };
			return request.googleOAuth;
		}
		if (typeof state !== 'string') throw new UnauthorizedException('OAuth state mismatch');

		const record = parseStateRecord(await this.redis.get(oauthStateKey(state)));
		if (!record) throw new UnauthorizedException('Expired session');
		const frontend = resolveGoogleOAuthFrontend(this.vps, record.frontend);
		// The frontend was removed from GOOGLE_OAUTH_FRONTENDS while this flow was in progress.
		if (!frontend) throw new UnauthorizedException('Expired session');
		// Known from here on, so an error below still returns to the right frontend and flow.
		request.googleOAuth = { identityId: record.identityId, frontend: frontend };
		// Check the cookie before deleting, so someone else's request can't burn this state.
		// Only an unbound login state written before the deploy may skip it (transition).
		const legacy = !record.bound && !record.identityId && acceptsLegacyState();
		if (!legacy && readCookie(request, OAUTH_STATE_COOKIE) !== state) {
			throw new UnauthorizedException('OAuth state mismatch');
		}
		// DEL is the single-use gate: only one callback can consume the state.
		if ((await this.redis.del(oauthStateKey(state))) === 0) {
			throw new UnauthorizedException('Expired session');
		}
		// The nonce is spent: drop its cookie instead of leaving it until it expires.
		response.clearCookie(OAUTH_STATE_COOKIE, this.stateCookieOptions(request));
		return request.googleOAuth;
	}
}
