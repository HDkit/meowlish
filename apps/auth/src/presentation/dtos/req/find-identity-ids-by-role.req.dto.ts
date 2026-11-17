import { auth } from '@server/generated';
import { IsString } from 'class-validator';

export class FindIdentityIdsByRoleDto implements auth.FindIdentityIdsByRoleDto {
	@IsString()
	role!: string;
}
