import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class MinimalAttemptInfoDto implements exam.UsersAttemptHistory_MinimalAttemptInfo {
	@Expose()
	examId!: string;

	@Expose()
	examName!: string;

	@Expose()
	durationLimit!: number;

	@Expose()
	endedAt?: Date;

	@Expose()
	id!: string;

	@Expose()
	isStrict!: boolean;

	@Expose()
	score?: number;

	@Expose()
	startedAt!: Date;

	@Expose()
	totalPoints?: number;
}

export class AttemptsHistoryDto implements exam.UsersAttemptHistory {
	@Expose()
	@Type(() => MinimalAttemptInfoDto)
	attempts!: MinimalAttemptInfoDto[];

	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;
}
