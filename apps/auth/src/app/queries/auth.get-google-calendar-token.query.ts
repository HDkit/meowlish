import { Query } from '@server/utils';

export type GoogleCalendarTokenResult = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string;
};

export class GetGoogleCalendarTokenQuery extends Query<
	GoogleCalendarTokenResult,
	{ identityId: string }
> {}
