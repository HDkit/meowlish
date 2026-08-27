import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class LockIdentityDto implements auth.LockIdentityDto {
	@IsString()
	identityId!: string;

	@IsString()
	lockedBy!: string;
}
