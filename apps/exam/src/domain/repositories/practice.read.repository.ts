import { AttemptHistorySummary } from '../read-models/practice/attempt-history-summary.read-model';
import { DetailedAttemptReviewData } from '../read-models/practice/attempt-review.read-model';
import { AttemptSavedData } from '../read-models/practice/attempt-save-data.read-model';
import { DetailedExamInfo } from '../read-models/practice/detailed-exam.read-model';
import { DetailedQuestionInfo } from '../read-models/practice/detailed-question.read-model';
import { ExamStatistics } from '../read-models/practice/exam-statistics.read-model';
import { MinimalAttemptInfo } from '../read-models/practice/minimal-attempt.read-model';
import { MinimalExamInfo } from '../read-models/practice/minimal-exam.read-model';
import { UserStats } from '../read-models/practice/user-stats.read-model';
import { SortDirection } from '@server/typing';

export interface IPracticeReadRepository {
	// if doesn't exist return default values
	getUserStats(uid: string): Promise<UserStats>;
	getUsersAttemptSummary(
		uid: string,
		range?: { from: Date; to: Date },
	): Promise<AttemptHistorySummary>;
	getUsersAttemptHistory(
		uid: string,
		options?: {
			examId?: string;
			sortBy?: { key: 'endedAt' | 'startedAt' | 'examId' | 'score'; direction: SortDirection };
			lastId?: string;
			limit?: number;
			direction?: number;
		},
	): Promise<MinimalAttemptInfo[]>;
	findExams(options?: {
		filter?: { name?: string; tags?: string[] };
		sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
		lastCursor?: {
			id: string;
			attemptsCount?: number;
			updatedAt?: Date;
		};
		limit?: number;
		direction?: number;
	}): Promise<MinimalExamInfo[]>;
	getExamDetail(examId: string): Promise<DetailedExamInfo | null>;
	getExamStats(examId: string): Promise<ExamStatistics | null>;
	getAttemptSavedData(attemptId: string): Promise<AttemptSavedData | null>;
	getAttemptReview(attemptId: string): Promise<DetailedAttemptReviewData | null>;
	getDetailedQuestionInfo(questionId: string): Promise<DetailedQuestionInfo | null>;
}

export const IPracticeReadRepositoryToken = Symbol('IPracticeReadRepository');
