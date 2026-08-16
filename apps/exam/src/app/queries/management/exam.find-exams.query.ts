import { ExamManagementMinimalInfo } from '../../../domain/read-models/management/exam-info.read-model';
import { ExamStatus } from '../../../enums/exam-status.enum';
import { SortDirection } from '@server/typing';
import { Query } from '@server/utils';

export type FindExamsForManagementQueryResult = {
	exams: ExamManagementMinimalInfo[];
	cursor: string;
};

export type FindExamsForManagementQueryPayload = {
	cursor?: string;
} & Omit<FindExamsForManagementCursor, 'lastId'>;

export type FindExamsForManagementCursor = {
	// high prec
	filter?: {
		title?: string;
		createdBy?: string;
		status?: ExamStatus;
		createdTimeRange?: { from: Date; to: Date };
		updatedTimeRange?: { from: Date; to: Date };
	};
	sortBy?: { key: 'updatedAt' | 'createdAt'; direction: SortDirection };
	lastId?: string;
	// low prec
	limit?: number;
};

export class FindExamsForManagementQuery extends Query<
	FindExamsForManagementQueryResult,
	FindExamsForManagementQueryPayload
> {}
