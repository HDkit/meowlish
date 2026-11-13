import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class BlogCommentDto implements resource.BlogCommentResponse {
	@Expose()
	id!: string;

	@Expose()
	blogId!: string;

	@Expose()
	parentId?: string;

	@Expose()
	authorId!: string;

	@Expose()
	content!: string;

	@Expose()
	depth!: number;

	@Expose()
	deleted!: boolean;

	@Expose()
	editedAt?: string;

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;

	@Expose()
	@Type(() => BlogCommentDto)
	replies!: BlogCommentDto[];
}

export class ListBlogCommentsDto implements resource.ListBlogCommentsResponse {
	@Expose()
	@Type(() => BlogCommentDto)
	comments!: BlogCommentDto[];

	@Expose()
	totalThreads!: number;

	@Expose()
	totalComments!: number;
}
