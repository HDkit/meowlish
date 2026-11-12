import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class UpdateMailPasswordDto {
	@IsString()
	@ApiProperty()
	id!: string;

	@IsString()
	@MinLength(1)
	@ApiProperty()
	currentPassword!: string;

	@IsString()
	@IsStrongPassword()
	@ApiProperty()
	password!: string;
}
