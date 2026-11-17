import { auth } from '@server/generated';
import { IsString, IsStrongPassword } from 'class-validator';

export class UpdateMailPasswordDto implements auth.UpdateMailPasswordDto {
	@IsString()
	identityId!: string;

	@IsString()
	id!: string;

	@IsString()
	currentPassword!: string;

	@IsString()
	@IsStrongPassword()
	password!: string;
}
