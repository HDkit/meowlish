import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { achievement } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class LoginProgressDto implements achievement.UserProgressDto_LoginProgress {
	@Expose()
	@ApiProperty()
	longestStreak!: number;

	@Expose()
	@ApiProperty()
	streak!: number;

	@Expose()
	@ApiProperty()
	total!: number;
}

class SubmissionProgressDto implements achievement.UserProgressDto_SubmissionProgress {
	@Expose()
	@ApiProperty()
	goodScore!: number;

	@Expose()
	@ApiProperty()
	perfectScore!: number;

	@Expose()
	@ApiProperty()
	total!: number;
}

export class ProgressDto implements achievement.UserProgressDto {
	@Expose()
	@Type(() => LoginProgressDto)
	@ApiPropertyOptional({ type: () => LoginProgressDto })
	loginProgress?: LoginProgressDto;

	@Expose()
	@Type(() => SubmissionProgressDto)
	@ApiPropertyOptional({ type: () => SubmissionProgressDto })
	submissionProgress?: SubmissionProgressDto;
}
