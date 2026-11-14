import { auth } from '@server/generated';
import { Expose } from 'class-transformer';

/** Short-lived access token only; the refresh token never leaves auth. */
export class GoogleCalendarAccessTokenDto implements auth.GoogleCalendarAccessToken {
	@Expose()
	accessToken!: string;

	@Expose()
	expiresAt!: number;
}

export class GoogleCalendarConnectionDto implements auth.GoogleCalendarConnection {
	@Expose()
	connected!: boolean;

	@Expose()
	expiresAt!: number;
}
