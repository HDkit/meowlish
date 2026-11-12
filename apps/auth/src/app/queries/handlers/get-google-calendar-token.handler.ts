import { IEnvVars } from '../../../configs/config';
import {
	type IGoogleCalendarTokenRepository,
	IGoogleCalendarTokenRepositoryToken,
} from '../../../domain/repositories/google-calendar-token.repository';
import {
	GetGoogleCalendarTokenQuery,
	GoogleCalendarAccessTokenResult,
} from '../auth.get-google-calendar-token.query';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

/** Refresh slightly early so callers never receive a token about to expire. */
const EXPIRY_SKEW_MS = 60_000;

@QueryHandler(GetGoogleCalendarTokenQuery)
export class GetGoogleCalendarTokenQueryHandler implements IQueryHandler<GetGoogleCalendarTokenQuery> {
	constructor(
		@Inject(IGoogleCalendarTokenRepositoryToken)
		private readonly tokenRepository: IGoogleCalendarTokenRepository,
		private readonly configService: ConfigService<IEnvVars>,
	) {}

	async execute(query: GetGoogleCalendarTokenQuery): Promise<GoogleCalendarAccessTokenResult> {
		const token = await this.tokenRepository.findByIdentityId(query.payload.identityId);
		if (!token) throw new NotFoundException('Google Calendar token not found');

		if (token.expiresAt.getTime() - EXPIRY_SKEW_MS > Date.now()) {
			return { accessToken: token.accessToken, expiresAt: token.expiresAt.getTime() };
		}

		if (!token.refreshToken) {
			throw new UnauthorizedException('Google Calendar connection expired, reconnect');
		}

		const config = this.configService.getOrThrow('googleOAuth2', { infer: true });
		const res = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: config.secret,
				refresh_token: token.refreshToken,
				grant_type: 'refresh_token',
			}),
		});
		if (!res.ok) {
			throw new UnauthorizedException('Failed to refresh Google Calendar token, reconnect');
		}

		const body = (await res.json()) as {
			access_token: string;
			expires_in?: number;
			scope?: string;
			refresh_token?: string;
		};
		const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000);
		await this.tokenRepository.upsert({
			identityId: token.identityId,
			accessToken: body.access_token,
			// Google rarely rotates refresh tokens; keep ours unless it sends a new one.
			refreshToken: body.refresh_token ?? token.refreshToken,
			expiresAt: expiresAt,
			scopes: body.scope ?? token.scopes,
		});
		return { accessToken: body.access_token, expiresAt: expiresAt.getTime() };
	}
}
