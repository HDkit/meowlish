import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RemoveRoleFromDto {
	@IsString()
	@ApiProperty()
	roleId!: string;
}
