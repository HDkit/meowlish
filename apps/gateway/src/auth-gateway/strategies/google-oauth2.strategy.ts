import { type GoogleOAuthRequest } from '../../auth/guards/google-oauth2.guard';
import { IEnvVars } from '../../configs/config';
import { AUTH_CLIENT } from '../constants/auth';
import { GOOGLE_CALLBACK_PATH } from '../google-oauth-frontends';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from '@server/generated';
import { Profile, Strategy } from 'passport-google-oauth20';
import { lastValueFrom } from 'rxjs';

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
		// Linking flow (state checked and consumed by GoogleOAuth2CallbackGuard): add the credential to the
		// identity that started it
		const identityId = req.googleOAuth?.identityId;
		if (identityId) {
			await lastValueFrom(
				this.authService.addGoogleCredential({ identifier: id, identityId: identityId }),
			);
			return true;
		}
		// If can't find info, create new credential and new identity, else just login
		return await lastValueFrom(
			this.authService.registerOrLoginGoogle({ identifier: id, username: crypto.randomUUID() }),
		);
	}
}
