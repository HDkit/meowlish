import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsStrongPassword } from 'class-validator';

export class AddMailCredDto {
	@IsEmail()
	@IsString()
	@ApiProperty()
	mail!: string;

	@IsString()
	@IsStrongPassword()
	@ApiProperty()
	password!: string;
}
