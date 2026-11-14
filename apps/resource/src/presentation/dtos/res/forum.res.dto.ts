import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class ForumThreadSummaryDto implements resource.ForumThreadSummaryResponse {
	@Expose()
	id!: string;

	@Expose()
	slug?: string;

	@Expose()
	categoryId!: string;

	@Expose()
	authorId!: string;

	@Expose()
	title!: string;

	@Expose()
	excerpt!: string;

	@Expose()
	isPinned!: boolean;

	@Expose()
	isLocked!: boolean;

	@Expose()
	replyCount!: number;

	@Expose()
	viewCount!: number;

	@Expose()
	lastActivityAt!: string;

	@Expose()
	lastReplyAuthorId?: string;

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class ForumCategoryDto implements resource.ForumCategoryResponse {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	description!: string;

	@Expose()
	position!: number;

	@Expose()
	moderatorsOnly!: boolean;

	@Expose()
	threadCount!: number;

	@Expose()
	replyCount!: number;

	@Expose()
	@Type(() => ForumThreadSummaryDto)
	latestThread?: ForumThreadSummaryDto;
}

export class ListForumCategoriesDto implements resource.ListForumCategoriesResponse {
	@Expose()
	@Type(() => ForumCategoryDto)
	categories!: ForumCategoryDto[];
}

export class ForumThreadDto implements resource.ForumThreadResponse {
	@Expose()
	id!: string;

	@Expose()
	slug?: string;

	@Expose()
	categoryId!: string;

	@Expose()
	categoryName!: string;

	@Expose()
	authorId!: string;

	@Expose()
	title!: string;

	@Expose()
	body!: string;

	@Expose()
	isPinned!: boolean;

	@Expose()
	isLocked!: boolean;

	@Expose()
	replyCount!: number;

	@Expose()
	viewCount!: number;

	@Expose()
	lastActivityAt!: string;

	@Expose()
	lastReplyAuthorId?: string;

	@Expose()
	editedAt?: string;

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class ListForumThreadsDto implements resource.ListForumThreadsResponse {
	@Expose()
	@Type(() => ForumThreadSummaryDto)
	threads!: ForumThreadSummaryDto[];

	@Expose()
	totalCount!: number;
}

export class ForumQuoteDto implements resource.ForumQuoteResponse {
	@Expose()
	id!: string;

	@Expose()
	authorId!: string;

	@Expose()
	excerpt!: string;
}

export class ForumReplyDto implements resource.ForumReplyResponse {
	@Expose()
	id!: string;

	@Expose()
	threadId!: string;

	@Expose()
	authorId!: string;

	@Expose()
	body!: string;

	@Expose()
	position!: number;

	@Expose()
	@Type(() => ForumQuoteDto)
	quotedReply?: ForumQuoteDto;

	@Expose()
	editedAt?: string;

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class ListForumRepliesDto implements resource.ListForumRepliesResponse {
	@Expose()
	@Type(() => ForumReplyDto)
	replies!: ForumReplyDto[];

	@Expose()
	totalCount!: number;
}
