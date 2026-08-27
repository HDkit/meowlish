import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class DisconnectGoogleCalendarDto implements auth.DisconnectGoogleCalendarDto {
	@IsString()
	identityId!: string;
}
