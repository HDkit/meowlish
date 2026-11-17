export interface BlogReadModel {
	id: string;
	/** Readable URL key; unset only on rows the backfill has not reached yet. */
	slug?: string;
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

/** A tag and how many blog posts use it. */
export interface BlogTagCountReadModel {
	name: string;
	count: number;
}
