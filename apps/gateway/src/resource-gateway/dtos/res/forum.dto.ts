import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ForumThreadSummaryDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional({
		description:
			'Readable URL key from the title (never changes when the title is edited). Use it in links; the id works in its place. Missing only on old rows not yet backfilled.',
		example: 'cach-lam-bai-ielts-writing-task-2',
	})
	slug?: string;

	@Expose()
	@ApiProperty()
	categoryId!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty({ description: 'Plain-text start of the body' })
	excerpt!: string;

	@Expose()
	@ApiProperty()
	isPinned!: boolean;

	@Expose()
	@ApiProperty()
	isLocked!: boolean;

	@Expose()
	@ApiProperty()
	replyCount!: number;

	@Expose()
	@ApiProperty()
	viewCount!: number;

	@Expose()
	@ApiProperty({ format: 'date-time', description: 'Creation, or the latest reply' })
	lastActivityAt!: string;

	@Expose()
	@ApiPropertyOptional()
	lastReplyAuthorId?: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	createdAt!: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	updatedAt!: string;
}

export class ForumCategoryDto {
	@Expose()
	@ApiProperty({ example: 'ielts' })
	id!: string;

	@Expose()
	@ApiProperty({ example: 'IELTS' })
	name!: string;

	@Expose()
	@ApiProperty()
	description!: string;

	@Expose()
	@ApiProperty()
	position!: number;

	@Expose()
	@ApiProperty({ description: 'Only moderators may open threads here' })
	moderatorsOnly!: boolean;

	@Expose()
	@ApiProperty()
	threadCount!: number;

	@Expose()
	@ApiProperty()
	replyCount!: number;

	@Expose()
	@Type(() => ForumThreadSummaryDto)
	@ApiPropertyOptional({ type: () => ForumThreadSummaryDto, description: 'Most recently active' })
	latestThread?: ForumThreadSummaryDto;
}

export class ListForumCategoriesDto {
	@Expose()
	@Type(() => ForumCategoryDto)
	@ApiProperty({ type: () => [ForumCategoryDto] })
	categories!: ForumCategoryDto[];
}

export class ForumThreadDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional({
		description:
			'Readable URL key from the title (never changes when the title is edited). Use it in links; the id works in its place. Missing only on old rows not yet backfilled.',
		example: 'cach-lam-bai-ielts-writing-task-2',
	})
	slug?: string;

	@Expose()
	@ApiProperty()
	categoryId!: string;

	@Expose()
	@ApiProperty()
	categoryName!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty({ description: 'Markdown' })
	body!: string;

	@Expose()
	@ApiProperty()
	isPinned!: boolean;

	@Expose()
	@ApiProperty()
	isLocked!: boolean;

	@Expose()
	@ApiProperty()
	replyCount!: number;

	@Expose()
	@ApiProperty()
	viewCount!: number;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	lastActivityAt!: string;

	@Expose()
	@ApiPropertyOptional()
	lastReplyAuthorId?: string;

	@Expose()
	@ApiPropertyOptional({ format: 'date-time', description: 'Last edit by the author' })
	editedAt?: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	createdAt!: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	updatedAt!: string;
}

export class ListForumThreadsDto {
	@Expose()
	@Type(() => ForumThreadSummaryDto)
	@ApiProperty({ type: () => [ForumThreadSummaryDto] })
	threads!: ForumThreadSummaryDto[];

	@Expose()
	@ApiProperty()
	totalCount!: number;
}

export class ForumQuoteDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty({ description: 'Plain-text start of the quoted reply' })
	excerpt!: string;
}

export class ForumReplyDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	threadId!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty({ description: 'Markdown' })
	body!: string;

	@Expose()
	@ApiProperty({ description: '1-based position in the thread, oldest first' })
	position!: number;

	@Expose()
	@Type(() => ForumQuoteDto)
	@ApiPropertyOptional({ type: () => ForumQuoteDto })
	quotedReply?: ForumQuoteDto;

	@Expose()
	@ApiPropertyOptional({ format: 'date-time' })
	editedAt?: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	createdAt!: string;

	@Expose()
	@ApiProperty({ format: 'date-time' })
	updatedAt!: string;
}

export class ListForumRepliesDto {
	@Expose()
	@Type(() => ForumReplyDto)
	@ApiProperty({ type: () => [ForumReplyDto] })
	replies!: ForumReplyDto[];

	@Expose()
	@ApiProperty()
	totalCount!: number;
}
