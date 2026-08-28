import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword } from 'class-validator';

export class UpdateMailPasswordDto {
	@IsString()
	@ApiProperty()
	id!: string;

	@IsString()
	@IsStrongPassword()
	@ApiProperty()
	password!: string;
}
