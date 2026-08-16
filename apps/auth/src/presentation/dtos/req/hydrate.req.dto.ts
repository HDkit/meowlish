import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class HydrateDto implements auth.HydrateIdentityDto {
	@IsString()
	identityId!: string;
}
