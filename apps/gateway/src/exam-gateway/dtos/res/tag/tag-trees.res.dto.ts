import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class TagTreeDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@Type(() => TagTreeDto)
	@ApiProperty({ type: () => [TagTreeDto] })
	children!: TagTreeDto[];
}

export class TagTreesDto {
	@Expose()
	@Type(() => TagTreeDto)
	@ApiProperty({ type: () => [TagTreeDto] })
	trees!: TagTreeDto[];
}
