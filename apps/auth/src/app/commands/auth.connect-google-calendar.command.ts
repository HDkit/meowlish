import { Command } from '@server/utils';

export class ConnectGoogleCalendarCommand extends Command<{
	identityId: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string;
}> {}
