// for when searching
export type MinimalExamInfo = {
	id: string;
	/** Readable URL key; absent until the start-up backfill reaches an old exam. */
	slug?: string;
	name: string;
	description?: string;
	attemptsCount: number;
	duration: number;
	tags: string[]; //root tags only
	updatedAt: Date;
};
