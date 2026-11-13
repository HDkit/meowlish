import { type PageInput } from './pagination';

export interface ListBlogCommentsInput extends PageInput {
	blogId: string;
}

export interface CreateBlogCommentInput {
	blogId: string;
	content: string;
	parentId?: string;
}

export interface UpdateBlogCommentInput {
	id: string;
	content: string;
}
