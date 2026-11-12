import { Query } from '@server/utils';

/** Server-side view only; the refresh token never leaves auth. */
export type GoogleCalendarAccessTokenResult = {
	accessToken: string;
	expiresAt: number;
};

export class GetGoogleCalendarTokenQuery extends Query<
	GoogleCalendarAccessTokenResult,
	{ identityId: string }
> {}
