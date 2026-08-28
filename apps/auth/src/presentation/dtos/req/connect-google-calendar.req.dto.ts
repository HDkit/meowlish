import { auth } from '@server/generated';
import { IsNumber, IsString } from 'class-validator';

export class ConnectGoogleCalendarDto implements auth.ConnectGoogleCalendarDto {
	@IsString()
	identityId!: string;

	@IsString()
	accessToken!: string;

	@IsString()
	refreshToken!: string;

	@IsNumber()
	expiresAt!: number;

	@IsString()
	scopes!: string;
}
