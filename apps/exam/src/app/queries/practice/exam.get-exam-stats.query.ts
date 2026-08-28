import { ExamStatistics } from '../../../domain/read-models/practice/exam-statistics.read-model';
import { Query } from '@server/utils';

export type GetExamStatsQueryPayload = {
	examId: string;
};

export class GetExamStatsQuery extends Query<ExamStatistics, GetExamStatsQueryPayload> {}
