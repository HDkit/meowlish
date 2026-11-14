/**
 * `exam.attempt.rescored`: the stored score of an already scored attempt changed (AI writing
 * feedback arrived). Consumers adjust by the difference between `previousScore` and `score`.
 */
export type AttemptRescoredIntegrationEvent = {
	attemptId: string;
	attemptedBy: string;
	previousScore: number;
	score: number;
	totalPoints: number;
};
