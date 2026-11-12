import { type PageInput } from './pagination';

export interface CreateBlogInput {
	title: string;
	content: string;
	authorId: string;
	tags: string[];
}

export interface UpdateBlogInput {
	id: string;
	title?: string;
	content?: string;
	tags: string[];
}

export interface ListBlogsInput extends PageInput {
	authorId?: string;
	tags: string[];
}
