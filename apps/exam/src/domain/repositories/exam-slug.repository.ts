export interface IExamSlugRepository {
	/** Gives the exam a free slug made from `title` (no-op if it already has one); returns the slug. */
	assignSlug(examId: string, title: string): Promise<string>;
	/** Exams without a slug, oldest first. */
	findWithoutSlug(limit: number): Promise<{ id: string; title: string }[]>;
}

export const IExamSlugRepositoryToken = Symbol('IExamSlugRepository');
