import { type GoogleOAuthRequest } from '../../auth/guards/google-oauth2.guard';
import { IEnvVars } from '../../configs/config';
import { GoogleOAuthError } from '../../enums/google-oauth-error.enum';
import { AUTH_CLIENT } from '../constants/auth';
import { GoogleOAuthException } from '../google-oauth-callback.filter';
import { GOOGLE_CALLBACK_PATH } from '../google-oauth-frontends';
import { status } from '@grpc/grpc-js';
import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from '@server/generated';
import { Profile, Strategy } from 'passport-google-oauth20';
import { lastValueFrom } from 'rxjs';

const GOOGLE_LOGIN_TYPE = 'GOOGLE';

@Injectable()
export class GoogleOAuth2Strategy
	extends PassportStrategy(Strategy, 'google')
	implements OnModuleInit
{
	private authService!: auth.AuthServiceClient;

	constructor(
		@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		const env = configService.getOrThrow('googleOAuth2', { infer: true });

		super({
			clientID: env.clientId,
			clientSecret: env.secret,
			// default frontend; the Google guards override it per flow
			callbackURL: `${configService.getOrThrow('vps', { infer: true }).baseUrl}${GOOGLE_CALLBACK_PATH}`,
			scope: ['email', 'profile'],
			passReqToCallback: true,
		});
	}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	async validate(
		req: GoogleOAuthRequest,
		_: string,
		__: string,
		profile: Profile,
	): Promise<auth.Tokens | boolean> {
		const { id } = profile;
		// Linking flow (state checked and consumed by GoogleOAuth2CallbackGuard): add the credential
		// to the identity that started it
		const identityId = req.googleOAuth?.identityId;
		if (identityId) {
			await this.link(identityId, id);
			return true;
		}
		// If can't find info, create new credential and new identity, else just login
		return await lastValueFrom(
			this.authService.registerOrLoginGoogle({
				identifier: id,
				username: crypto.randomUUID(),
				fullName: profile.displayName || undefined,
				email: profile.emails?.[0]?.value,
			}),
		);
	}

	/** Errors carry the `?error=` code GoogleOAuthCallbackFilter sends to the frontend. */
	private async link(identityId: string, googleId: string): Promise<void> {
		const { credentials } = await lastValueFrom(
			this.authService.getCredentials({ identityId: identityId }),
		);
		// One sign-in method per type, so a second Google account (or the same one again) is refused.
		if (credentials.some(c => c.type === GOOGLE_LOGIN_TYPE)) {
			throw new GoogleOAuthException(GoogleOAuthError.AlreadyLinked, HttpStatus.CONFLICT);
		}
		try {
			await lastValueFrom(
				this.authService.addGoogleCredential({ identifier: googleId, identityId: identityId }),
			);
		} catch (err) {
			// not this account's Google credential (checked above), so another account's
			if ((err as { code?: unknown } | null)?.code === status.ALREADY_EXISTS) {
				throw new GoogleOAuthException(GoogleOAuthError.AccountInUse, HttpStatus.CONFLICT);
			}
			throw err;
		}
	}
}
