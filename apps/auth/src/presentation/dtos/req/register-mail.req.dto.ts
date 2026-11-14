import { auth } from '@server/generated';
import { IsEmail, IsString, IsStrongPassword, Matches, MaxLength } from 'class-validator';

/** Google sign-up generates at most 36 characters (a UUID fallback). */
const USERNAME_MAX_LENGTH = 50;

export class RegisterMailDto implements auth.RegisterMailDto {
	@IsEmail()
	mail!: string;

	@IsString()
	@MaxLength(USERNAME_MAX_LENGTH)
	@Matches(/\S/, { message: 'username must not be blank' })
	username!: string;

	@IsStrongPassword()
	password!: string;
}
