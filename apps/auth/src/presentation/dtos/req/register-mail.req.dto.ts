import { auth } from '@server/generated';
import { USERNAME_PATTERN, USERNAME_RULE_MESSAGE } from '@server/utils';
import { IsEmail, IsString, IsStrongPassword, Matches } from 'class-validator';

export class RegisterMailDto implements auth.RegisterMailDto {
	@IsEmail()
	mail!: string;

	@IsString()
	@Matches(USERNAME_PATTERN, { message: USERNAME_RULE_MESSAGE })
	username!: string;

	@IsStrongPassword()
	password!: string;
}
