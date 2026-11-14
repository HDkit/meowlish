import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class BlogCommentDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	blogId!: string;

	@Expose()
	@ApiPropertyOptional({ description: 'Absent for top-level comments' })
	parentId?: string;

	@Expose()
	@ApiProperty({ description: 'Empty once deleted' })
	authorId!: string;

	@Expose()
	@ApiProperty({ description: 'Markdown; empty once deleted' })
	content!: string;

	@Expose()
	@ApiProperty({ description: '0 for top-level comments' })
	depth!: number;

	@Expose()
	@ApiProperty({ description: 'Deleted, kept as a placeholder because it has replies' })
	deleted!: boolean;

	@Expose()
	@ApiPropertyOptional({ format: 'date-time' })
	editedAt?: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	createdAt!: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	updatedAt!: string;

	@Expose()
	@Type(() => BlogCommentDto)
	@ApiProperty({ type: () => [BlogCommentDto], description: 'Replies, oldest first' })
	replies!: BlogCommentDto[];
}

export class ListBlogCommentsDto {
	@Expose()
	@Type(() => BlogCommentDto)
	@ApiProperty({ type: () => [BlogCommentDto], description: 'Top-level comments, newest first' })
	comments!: BlogCommentDto[];

	@Expose()
	@ApiProperty({ description: 'Top-level comments in total (for paging)' })
	totalThreads!: number;

	@Expose()
	@ApiProperty({ description: 'Visible comments at any depth' })
	totalComments!: number;
}
