import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class TagNodeDto implements exam.TagList_TagNode {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	parentId?: string;
}

export class TagListDto implements exam.TagList {
	@Expose()
	@Type(() => TagNodeDto)
	list!: TagNodeDto[];
}
