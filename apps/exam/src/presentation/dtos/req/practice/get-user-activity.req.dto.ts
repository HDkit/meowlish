import { exam } from '@server/generated';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class GetUserActivityDto implements exam.GetUserActivityDto {
	@IsString()
	uid!: string;

	@IsInt()
	@IsOptional()
	@Max(371)
	@Min(1)
	days?: number;

	@IsOptional()
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	from?: string;

	@IsOptional()
	@IsString()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	to?: string;
}
