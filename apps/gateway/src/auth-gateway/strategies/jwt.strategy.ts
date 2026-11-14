import { IEnvVars } from '../../configs/config';
import { ACCESS_TOKEN_COOKIE, cookieExtractor } from '../auth-cookies';
import { AUTH_CLIENT } from '../constants/auth';
import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from '@server/generated';
import { Claims, isAccessTokenPayload, payloadSchema } from '@server/utils';
import { AuthPayload } from '@server/utils';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'access-jwt') implements OnModuleInit {
	private authService!: auth.AuthServiceClient;

	constructor(
		@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc,
		private readonly configService: ConfigService<IEnvVars>,
	) {
		super({
			// cookie first (browser session), then the Bearer header (API clients, Swagger)
			jwtFromRequest: ExtractJwt.fromExtractors([
				cookieExtractor(ACCESS_TOKEN_COOKIE),
				ExtractJwt.fromAuthHeaderAsBearerToken(),
			]),
			secretOrKey: configService.getOrThrow('jwt', { infer: true }).publicKey,
			algorithms: ['RS256'],
		});
	}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	async validate(payload: AuthPayload): Promise<Claims> {
		// safeParse: a malformed (but validly signed) payload is a 401, not a 500.
		// a refresh token (same signing key) must not authenticate requests
		if (!isAccessTokenPayload(payload) || !payloadSchema.safeParse(payload).success) {
			throw new UnauthorizedException('Invalid token');
		}

		await lastValueFrom(
			this.authService.validateAccess({
				identityId: payload.sub,
				iat: payload.iat,
				iatMs: payload.iatMs,
			}),
		);

		return {
			sub: payload.sub,
			permissions: payload.permissions,
			roles: payload.roles,
		};
	}
}
