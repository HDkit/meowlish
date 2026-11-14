import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
	@ApiProperty({ enum: ['endedAt', 'startedAt', 'examId', 'score'] })
	key!: 'endedAt' | 'startedAt' | 'examId' | 'score';

	@IsEnum(SortDirection)
	@ApiProperty({ enum: SortDirection })
	direction!: SortDirection;
}

const MAX_PAGE_LIMIT = 100;

export class GetUsersAttemptHistoryDto implements Omit<exam.GetUsersAttemptHistoryDto, 'uid'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	examId?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(MAX_PAGE_LIMIT)
	@ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100 })
	limit?: number;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => SortOptionsDto })
	sortBy?: SortOptionsDto;
}
