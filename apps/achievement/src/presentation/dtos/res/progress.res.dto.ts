import { achievement } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class LoginProgressDto implements achievement.UserProgressDto_LoginProgress {
	@Expose()
	longestStreak!: number;

	@Expose()
	streak!: number;

	@Expose()
	total!: number;
}

class SubmissionProgressDto implements achievement.UserProgressDto_SubmissionProgress {
	@Expose()
	goodScore!: number;

	@Expose()
	perfectScore!: number;

	@Expose()
	total!: number;
}

export class ProgressDto implements achievement.UserProgressDto {
	@Expose()
	@Type(() => LoginProgressDto)
	loginProgress?: LoginProgressDto;

	@Expose()
	@Type(() => SubmissionProgressDto)
	submissionProgress?: SubmissionProgressDto;
}
