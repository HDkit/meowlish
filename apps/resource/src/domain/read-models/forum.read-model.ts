export interface ForumThreadSummaryReadModel {
	id: string;
	categoryId: string;
	authorId: string;
	title: string;
	excerpt: string;
	isPinned: boolean;
	isLocked: boolean;
	replyCount: number;
	viewCount: number;
	lastActivityAt: string;
	lastReplyAuthorId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ForumCategoryReadModel {
	id: string;
	name: string;
	description: string;
	position: number;
	moderatorsOnly: boolean;
	threadCount: number;
	replyCount: number;
	latestThread?: ForumThreadSummaryReadModel;
}

export interface ForumCategoryListReadModel {
	categories: ForumCategoryReadModel[];
}

export interface ForumThreadReadModel {
	id: string;
	categoryId: string;
	categoryName: string;
	authorId: string;
	title: string;
	body: string;
	isPinned: boolean;
	isLocked: boolean;
	replyCount: number;
	viewCount: number;
	lastActivityAt: string;
	lastReplyAuthorId?: string;
	editedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ForumThreadListReadModel {
	threads: ForumThreadSummaryReadModel[];
	totalCount: number;
}

export interface ForumQuoteReadModel {
	id: string;
	authorId: string;
	excerpt: string;
}

export interface ForumReplyReadModel {
	id: string;
	threadId: string;
	authorId: string;
	body: string;
	position: number;
	quotedReply?: ForumQuoteReadModel;
	editedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ForumReplyListReadModel {
	replies: ForumReplyReadModel[];
	totalCount: number;
}
