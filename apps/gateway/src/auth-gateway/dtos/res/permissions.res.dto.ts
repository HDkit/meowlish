import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PermissionsDto {
	@Expose()
	@ApiProperty({ type: () => [String] })
	perms!: string[];
}
