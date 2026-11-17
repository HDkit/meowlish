import { exam } from '@server/generated';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetUserActivityDto implements exam.GetUserActivityDto {
	@IsString()
	uid!: string;

	@IsInt()
	@IsOptional()
	@Max(371)
	@Min(1)
	days?: number;
}
