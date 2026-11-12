export interface BlogReadModel {
	id: string;
	title: string;
	content: string;
	authorId: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface BlogListReadModel {
	blogs: BlogReadModel[];
	totalCount: number;
}
