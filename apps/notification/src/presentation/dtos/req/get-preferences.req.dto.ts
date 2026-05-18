import { notification } from '@server/generated';
import { IsString } from 'class-validator';

export class GetPreferencesReqDto implements notification.GetPreferencesRequest {
	@IsString()
	identityId!: string | undefined;
}
