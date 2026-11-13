import { exam } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class ActivityDayDto implements exam.UserActivity_Day {
	@Expose()
	attempts!: number;

	@Expose()
	date!: string;

	@Expose()
	minutes!: number;
}

export class UserActivityDto implements exam.UserActivity {
	@Expose()
	activeDays!: number;

	@Expose()
	currentStreak!: number;

	@Expose()
	@Type(() => ActivityDayDto)
	days!: ActivityDayDto[];

	@Expose()
	from!: string;

	@Expose()
	longestStreak!: number;

	@Expose()
	to!: string;

	@Expose()
	totalAttempts!: number;
}
