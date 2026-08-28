import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class TagNodeDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiPropertyOptional()
	parentId?: string;
}

export class TagListDto {
	@Expose()
	@Type(() => TagNodeDto)
	@ApiProperty({ type: () => [TagNodeDto] })
	list!: TagNodeDto[];
}
