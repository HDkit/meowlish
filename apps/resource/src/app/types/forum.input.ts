import { type PageInput } from './pagination';

export interface ListForumThreadsInput extends PageInput {
	categoryId: string;
	search?: string;
}

export interface CreateForumThreadInput {
	categoryId: string;
	title: string;
	body: string;
}

export interface UpdateForumThreadInput {
	id: string;
	title?: string;
	body?: string;
}

export interface ModerateForumThreadInput {
	id: string;
	isPinned?: boolean;
	isLocked?: boolean;
}

export interface ListForumRepliesInput extends PageInput {
	threadId: string;
}

export interface CreateForumReplyInput {
	threadId: string;
	body: string;
	quotedReplyId?: string;
}

export interface UpdateForumReplyInput {
	id: string;
	body: string;
}
