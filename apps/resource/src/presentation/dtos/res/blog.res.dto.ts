import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class BlogDto implements resource.BlogResponse {
	@Expose()
	id!: string;

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

export class ListBlogsDto implements resource.ListBlogsResponse {
	@Expose()
	@Type(() => BlogDto)
	blogs!: BlogDto[];

	@Expose()
	totalCount!: number;
}
