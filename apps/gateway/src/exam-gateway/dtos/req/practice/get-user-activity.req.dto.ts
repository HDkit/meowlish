import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class GetUserActivityDto implements Omit<exam.GetUserActivityDto, 'uid'> {
	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(371)
	@Min(1)
	@ApiPropertyOptional({
		type: Number,
		minimum: 1,
		maximum: 371,
		default: 182,
		description: 'How many UTC days back from today (inclusive) to return. Not with `from`/`to`',
	})
	days?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: '2026-10-01',
		description:
			'First UTC day of an explicit range (inclusive). Send with `to`; at most 371 days in all',
	})
	@Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be a day written YYYY-MM-DD' })
	from?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: '2026-10-31',
		description: 'Last UTC day of an explicit range (inclusive). Send with `from`',
	})
	@Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be a day written YYYY-MM-DD' })
	to?: string;
}
