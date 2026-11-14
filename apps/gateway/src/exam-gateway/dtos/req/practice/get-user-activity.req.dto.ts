import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
		description: 'How many UTC days back from today (inclusive) to return',
	})
	days?: number;
}
