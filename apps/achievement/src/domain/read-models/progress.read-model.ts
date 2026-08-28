type LoginProgress = {
	streak: number;
	longestStreak: number;
	total: number;
};

type SubmissionProgress = {
	goodScore: number;
	perfectScore: number;
	total: number;
};

export type Progress = {
	loginProgress?: LoginProgress;
	submissionProgress?: SubmissionProgress;
};
