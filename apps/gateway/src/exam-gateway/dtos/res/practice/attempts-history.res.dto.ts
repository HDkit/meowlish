import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class MinimalAttemptInfoDto {
	@Expose()
	@ApiProperty()
	examId!: string;

	@Expose()
	@ApiProperty()
	examName!: string;

	@Expose()
	@ApiProperty({ type: Number })
	durationLimit!: number;

	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	endedAt?: Date;

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	isStrict!: boolean;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	score?: number;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	startedAt!: Date;

	@Expose()
	@ApiPropertyOptional({ type: Number })
	totalPoints?: number;
}

export class AttemptsHistoryDto {
	@Expose()
	@Type(() => MinimalAttemptInfoDto)
	@ApiProperty({ type: () => [MinimalAttemptInfoDto] })
	attempts!: MinimalAttemptInfoDto[];

	@Expose()
	@ApiProperty()
	cursor!: string;
}
