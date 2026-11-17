import { ApiProperty } from '@nestjs/swagger';
import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	USERNAME_PATTERN,
	USERNAME_RULE_MESSAGE,
} from '@server/utils';
import { IsEmail, IsString, IsStrongPassword, Matches } from 'class-validator';

export class RegisterMailDto {
	@IsEmail()
	@ApiProperty()
	mail!: string;

	@IsString()
	@ApiProperty({
		minLength: USERNAME_MIN_LENGTH,
		maxLength: USERNAME_MAX_LENGTH,
		pattern: USERNAME_PATTERN.source,
		example: 'minh.nguyen',
		description: 'Lowercase letters, digits, ".", "_" and "-".',
	})
	@Matches(USERNAME_PATTERN, { message: USERNAME_RULE_MESSAGE })
	username!: string;

	@IsStrongPassword()
	@ApiProperty()
	password!: string;
}
