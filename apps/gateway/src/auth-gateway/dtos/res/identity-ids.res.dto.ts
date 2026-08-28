import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class IdentityIdsDto {
	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;

	@Expose()
	@ApiProperty()
	ids!: string[];
}
