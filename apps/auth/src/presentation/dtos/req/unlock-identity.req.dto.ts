import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class UnlockIdentityDto implements auth.UnlockIdentityDto {
	@IsString()
	identityId!: string;
}
