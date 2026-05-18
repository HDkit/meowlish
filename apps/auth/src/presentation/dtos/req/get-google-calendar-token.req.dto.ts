import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class GetGoogleCalendarTokenDto implements auth.GetGoogleCalendarTokenDto {
	@IsString()
	identityId!: string;
}
