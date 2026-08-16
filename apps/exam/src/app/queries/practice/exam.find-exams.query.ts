import { MinimalExamInfo } from '../../../domain/read-models/practice/minimal-exam.read-model';
import { SortDirection } from '@server/typing';
import { Query } from '@server/utils';

export type FindExamsQueryResult = {
	exams: MinimalExamInfo[];
	cursor: string;
};

export type FindExamsQueryPayload = {
	cursor?: string;
} & Omit<FindExamsCursor, 'lastCursor'>;

export type FindExamsCursor = {
	// high prec
	filter?: { name?: string; tags?: string[] };
	sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
	lastCursor?: {
		id: string;
		attemptsCount?: number;
		updatedAt?: number;
	};
	// low prec
	limit?: number;
};

export class FindExamsQuery extends Query<FindExamsQueryResult, FindExamsQueryPayload> {}
