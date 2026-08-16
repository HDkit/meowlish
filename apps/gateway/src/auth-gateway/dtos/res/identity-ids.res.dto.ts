import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class IdentityIdsDto {
	@Expose()
	@ApiProperty()
	cursor!: string;

	@Expose()
	@ApiProperty()
	ids!: string[];
}
