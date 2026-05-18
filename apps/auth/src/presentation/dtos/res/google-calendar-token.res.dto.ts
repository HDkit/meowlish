import { auth } from '@server/generated';
import { Expose } from 'class-transformer';

export class GoogleCalendarTokenResponseDto implements auth.GoogleCalendarTokenResponse {
	@Expose()
	accessToken!: string;

	@Expose()
	refreshToken!: string;

	@Expose()
	expiresAt!: number;

	@Expose()
	scopes!: string;
}
