import { IEnvVars } from '../../configs/config';
import { AUTH_CLIENT } from '../constants/auth';
import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from '@server/generated';
import { Claims, payloadSchema } from '@server/utils';
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
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: configService.getOrThrow('jwt', { infer: true }).publicKey,
			algorithms: ['RS256'],
		});
	}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	async validate(payload: AuthPayload): Promise<Claims> {
		const isCorrectSchema = payloadSchema.parse(payload);
		if (!isCorrectSchema) {
			throw new UnauthorizedException('Invalid token');
		}

		await lastValueFrom(
			this.authService.validateAccess({ identityId: payload.sub, iat: payload.iat }),
		);

		return {
			sub: payload.sub,
			permissions: payload.permissions,
			roles: payload.roles,
		};
	}
}
