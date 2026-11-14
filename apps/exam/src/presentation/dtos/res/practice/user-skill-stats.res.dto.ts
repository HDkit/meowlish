import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class ScorePointDto implements exam.UserSkillStats_ScorePoint {
	@Expose()
	attemptId!: string;

	@Expose()
	band?: number;

	@Expose()
	endedAt!: Date;

	@Expose()
	examTitle!: string;

	@Expose()
	percent!: number;
}

class SkillStatsDto implements exam.UserSkillStats_SkillStats {
	@Expose()
	attempts!: number;

	@Expose()
	averageBand?: number;

	@Expose()
	averagePercent?: number;

	@Expose()
	bestPercent?: number;

	@Expose()
	lastPercent?: number;

	@Expose()
	@Type(() => ScorePointDto)
	recent!: ScorePointDto[];

	@Expose()
	skill!: string;
}

class TagAccuracyDto implements exam.UserSkillStats_TagAccuracy {
	@Expose()
	correct!: number;

	@Expose()
	incorrect!: number;

	@Expose()
	name!: string;

	@Expose()
	skipped!: number;
}

export class UserSkillStatsDto implements exam.UserSkillStats {
	@Expose()
	attemptsConsidered!: number;

	@Expose()
	@Type(() => SkillStatsDto)
	skills!: SkillStatsDto[];

	@Expose()
	@Type(() => TagAccuracyDto)
	tags!: TagAccuracyDto[];
}
