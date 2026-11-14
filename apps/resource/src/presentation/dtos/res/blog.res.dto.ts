import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class BlogDto implements resource.BlogResponse {
	@Expose()
	id!: string;

	@Expose()
	slug?: string;

	@Expose()
	title!: string;

	@Expose()
	content!: string;

	@Expose()
	authorId!: string;

	@Expose()
	tags!: string[];

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class BlogTagCountDto implements resource.BlogTagCount {
	@Expose()
	name!: string;

	@Expose()
	count!: number;
}

export class ListBlogTagsDto implements resource.ListBlogTagsResponse {
	@Expose()
	@Type(() => BlogTagCountDto)
	tags!: BlogTagCountDto[];
}

export class ListBlogsDto implements resource.ListBlogsResponse {
	@Expose()
	@Type(() => BlogDto)
	blogs!: BlogDto[];

	@Expose()
	totalCount!: number;
}
