import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class ActivityDayDto {
	@Expose()
	@ApiProperty({ type: Number, description: 'Attempts finished that day' })
	attempts!: number;

	@Expose()
	@ApiProperty({ example: '2026-11-13', description: 'UTC day, YYYY-MM-DD' })
	date!: string;

	@Expose()
	@ApiProperty({ type: Number, description: 'Practice time, each attempt capped at 3 h' })
	minutes!: number;
}

export class UserActivityDto {
	@Expose()
	@ApiProperty({ type: Number, description: 'All-time days with a finished attempt' })
	activeDays!: number;

	@Expose()
	@ApiProperty({
		type: Number,
		description: 'Consecutive UTC days with practice, ending today or yesterday',
	})
	currentStreak!: number;

	@Expose()
	@Type(() => ActivityDayDto)
	@ApiProperty({ type: () => [ActivityDayDto], description: 'Only days with activity, ascending' })
	days!: ActivityDayDto[];

	@Expose()
	@ApiProperty({ example: '2026-05-16', description: 'First day of the range (UTC)' })
	from!: string;

	@Expose()
	@ApiProperty({ type: Number })
	longestStreak!: number;

	@Expose()
	@ApiProperty({ example: '2026-11-13', description: 'Today (UTC)' })
	to!: string;

	@Expose()
	@ApiProperty({ type: Number, description: 'All-time finished attempts' })
	totalAttempts!: number;
}
