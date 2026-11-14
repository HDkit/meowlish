import { AttemptHistorySummary } from '../read-models/practice/attempt-history-summary.read-model';
import { DetailedAttemptReviewData } from '../read-models/practice/attempt-review.read-model';
import { AttemptSavedData } from '../read-models/practice/attempt-save-data.read-model';
import { DetailedExamInfo } from '../read-models/practice/detailed-exam.read-model';
import { DetailedQuestionInfo } from '../read-models/practice/detailed-question.read-model';
import { ExamStatistics } from '../read-models/practice/exam-statistics.read-model';
import { MinimalAttemptInfo } from '../read-models/practice/minimal-attempt.read-model';
import { MinimalExamInfo } from '../read-models/practice/minimal-exam.read-model';
import { ActivityDayRow } from '../read-models/practice/user-activity.read-model';
import { SkillStatsSource } from '../read-models/practice/user-skill-stats.read-model';
import { UserStats } from '../read-models/practice/user-stats.read-model';
import { SortDirection } from '@server/typing';

export interface IPracticeReadRepository {
	/** Owner (attemptedBy) of an attempt, or null if it doesn't exist. */
	getAttemptOwner(attemptId: string): Promise<string | null>;
	// if doesn't exist return default values
	getUserStats(uid: string): Promise<UserStats>;
	getUsersAttemptSummary(
		uid: string,
		range?: { from: Date; to: Date },
	): Promise<AttemptHistorySummary>;
	/** Finished attempts (and capped practice time) per UTC day, over the user's whole history. */
	getUserActivityDays(uid: string): Promise<ActivityDayRow[]>;
	/** What the skill stats are built from, for the user's `limit` most recent finished attempts. */
	getUserSkillStatsSource(uid: string, limit: number): Promise<SkillStatsSource>;
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
		filter?: { name?: string; tags?: string[]; requiredTags?: string[] };
		sortBy?: { key: 'attemptsCount' | 'updatedAt'; direction: SortDirection };
		lastCursor?: {
			id: string;
			attemptsCount?: number;
			updatedAt?: Date;
		};
		limit?: number;
		direction?: number;
		/** 1-based page: OFFSET pagination; `lastCursor`/`direction` are ignored. */
		page?: number;
	}): Promise<MinimalExamInfo[]>;
	/** How many approved exams match the filter (page mode's total). */
	countExams(filter?: { name?: string; tags?: string[]; requiredTags?: string[] }): Promise<number>;
	getExamDetail(examId: string): Promise<DetailedExamInfo | null>;
	getExamStats(examId: string): Promise<ExamStatistics | null>;
	getAttemptSavedData(attemptId: string): Promise<AttemptSavedData | null>;
	getAttemptReview(attemptId: string): Promise<DetailedAttemptReviewData | null>;
	getDetailedQuestionInfo(questionId: string): Promise<DetailedQuestionInfo | null>;
}

export const IPracticeReadRepositoryToken = Symbol('IPracticeReadRepository');
