import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class RoleDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiProperty({ type: () => [String] })
	permissions!: string[];
}

export class RolesDto {
	@Expose()
	@Type(() => RoleDto)
	@ApiProperty({ type: () => RoleDto })
	roles!: RoleDto[];
}
