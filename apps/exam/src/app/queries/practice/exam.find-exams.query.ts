import { MinimalExamInfo } from '../../../domain/read-models/practice/minimal-exam.read-model';
import { SortDirection } from '@server/typing';
import { Query } from '@server/utils';

export type FindExamsQueryResult = {
	exams: MinimalExamInfo[];
	nextCursor: string;
	prevCursor: string;
	/** Page mode only: every matching exam. */
	totalCount?: number;
};

export type FindExamsQueryPayload = {
	cursor?: string;
	/** 1-based page number: offset pagination (the cursor is ignored). */
	page?: number;
} & Omit<FindExamsCursor, 'lastCursor'>;

export type FindExamsCursor = {
	// high prec
	filter?: { name?: string; tags?: string[]; requiredTags?: string[] };
	sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
	lastCursor?: {
		id: string;
		attemptsCount?: number;
		updatedAt?: number;
	};
	direction?: number;
	// low prec
	limit?: number;
};

export class FindExamsQuery extends Query<FindExamsQueryResult, FindExamsQueryPayload> {}
