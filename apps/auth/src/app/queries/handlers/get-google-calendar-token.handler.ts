import {
	type IGoogleCalendarTokenRepository,
	IGoogleCalendarTokenRepositoryToken,
} from '../../../domain/repositories/google-calendar-token.repository';
import {
	GetGoogleCalendarTokenQuery,
	GoogleCalendarTokenResult,
} from '../auth.get-google-calendar-token.query';
import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetGoogleCalendarTokenQuery)
export class GetGoogleCalendarTokenQueryHandler
	implements IQueryHandler<GetGoogleCalendarTokenQuery>
{
	constructor(
		@Inject(IGoogleCalendarTokenRepositoryToken)
		private readonly tokenRepository: IGoogleCalendarTokenRepository,
	) {}

	async execute(query: GetGoogleCalendarTokenQuery): Promise<GoogleCalendarTokenResult> {
		const token = await this.tokenRepository.findByIdentityId(query.payload.identityId);
		if (!token) throw new NotFoundException('Google Calendar token not found');
		return {
			accessToken: token.accessToken,
			refreshToken: token.refreshToken,
			expiresAt: token.expiresAt.getTime(),
			scopes: token.scopes,
		};
	}
}
