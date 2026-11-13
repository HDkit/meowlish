import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class ScorePointDto {
	@Expose()
	@ApiProperty()
	attemptId!: string;

	@Expose()
	@ApiPropertyOptional({ type: Number, description: 'Average AI writing band (0-9)' })
	band?: number;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	endedAt!: Date;

	@Expose()
	@ApiProperty()
	examTitle!: string;

	@Expose()
	@ApiProperty({ type: Number, description: 'Score on this skill in that attempt, 0-100' })
	percent!: number;
}

class SkillStatsDto {
	@Expose()
	@ApiProperty({ type: Number, description: 'Attempts that practised this skill' })
	attempts!: number;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	averageBand?: number;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	averagePercent?: number;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	bestPercent?: number;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	lastPercent?: number;

	@Expose()
	@Type(() => ScorePointDto)
	@ApiProperty({ type: () => [ScorePointDto], description: 'Up to 10 latest, oldest first' })
	recent!: ScorePointDto[];

	@Expose()
	@ApiProperty({ enum: ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] })
	skill!: string;
}

class TagAccuracyDto {
	@Expose()
	@ApiProperty({ type: Number })
	correct!: number;

	@Expose()
	@ApiProperty({ type: Number })
	incorrect!: number;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiProperty({ type: Number })
	skipped!: number;
}

export class UserSkillStatsDto {
	@Expose()
	@ApiProperty({ type: Number, description: 'Latest finished attempts looked at (max 100)' })
	attemptsConsidered!: number;

	@Expose()
	@Type(() => SkillStatsDto)
	@ApiProperty({ type: () => [SkillStatsDto], description: 'Always all four skills' })
	skills!: SkillStatsDto[];

	@Expose()
	@Type(() => TagAccuracyDto)
	@ApiProperty({ type: () => [TagAccuracyDto], description: 'Question tags, weakest first' })
	tags!: TagAccuracyDto[];
}
