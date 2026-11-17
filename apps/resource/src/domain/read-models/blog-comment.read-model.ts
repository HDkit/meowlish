export interface BlogCommentReadModel {
	id: string;
	blogId: string;
	parentId?: string;
	/** Empty once deleted. */
	authorId: string;
	/** Markdown; empty once deleted. */
	content: string;
	depth: number;
	deleted: boolean;
	editedAt?: string;
	createdAt: string;
	updatedAt: string;
	replies: BlogCommentReadModel[];
}

export interface BlogCommentListReadModel {
	comments: BlogCommentReadModel[];
	totalThreads: number;
	totalComments: number;
}
