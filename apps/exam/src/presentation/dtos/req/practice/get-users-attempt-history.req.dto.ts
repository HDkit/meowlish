import { exam } from '@server/generated';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	Max,
	ValidateNested,
} from 'class-validator';

class SortOptionsDto implements exam.GetUsersAttemptHistoryDto_SortOption {
	@IsIn(['endedAt', 'startedAt', 'examId', 'score'])
	key!: 'endedAt' | 'startedAt' | 'examId' | 'score';

	@IsEnum(SortDirection)
	direction!: SortDirection;
}

const MAX_PAGE_LIMIT = 100;

export class GetUsersAttemptHistoryDto implements exam.GetUsersAttemptHistoryDto {
	@IsString()
	uid!: string;

	@IsOptional()
	@IsString()
	examId?: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(MAX_PAGE_LIMIT)
	limit?: number;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	sortBy?: SortOptionsDto;
}
