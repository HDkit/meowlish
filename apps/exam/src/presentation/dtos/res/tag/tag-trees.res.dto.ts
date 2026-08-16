import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class TagTreeDto implements exam.TagTrees_TagTree {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	@Type(() => TagTreeDto)
	children!: TagTreeDto[];
}

export class TagTreesDto implements exam.TagTrees {
	@Expose()
	@Type(() => TagTreeDto)
	trees!: TagTreeDto[];
}
