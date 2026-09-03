import { IEnvVars } from '../../configs/config';
import { AUTH_CLIENT } from '../constants/auth';
import { Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ClientGrpc } from '@nestjs/microservices';
import { PassportStrategy } from '@nestjs/passport';
import { auth } from '@server/generated';
import { Claims, refreshPayloadSchema } from '@server/utils';
import { AuthRefreshPayload } from '@server/utils';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class JwtRefreshStrategy
	extends PassportStrategy(Strategy, 'refresh-jwt')
	implements OnModuleInit
{
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

	async validate(payload: AuthRefreshPayload): Promise<Claims> {
		const isCorrectSchema = refreshPayloadSchema.parse(payload);
		if (!isCorrectSchema) {
			throw new UnauthorizedException('Invalid token');
		}

		const claims = await lastValueFrom(
			this.authService.validateRefresh({ identityId: payload.sub, iat: payload.iat }),
		);
		return claims as Claims;
	}
}
