// view when listing attempt history
export type MinimalAttemptInfo = {
	id: string;
	examId: string;
	examName: string;
	startedAt: Date;
	endedAt?: Date;
	durationLimit: number;
	score?: number;
	totalPoints?: number;
	isStrict: boolean;
};
