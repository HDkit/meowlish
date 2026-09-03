import { ExamStatus } from '../../../../enums/exam-status.enum';
import { exam } from '@server/generated';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

class TimeRangeDto implements exam.FindExamsManagementDto_TimeRange {
	@Type(() => Date)
	@IsDate()
	from!: Date;

	@Type(() => Date)
	@IsDate()
	to!: Date;
}

class FilterOptionsDto implements exam.FindExamsManagementDto_FilterOption {
	@IsOptional()
	@IsString()
	createdBy?: string;

	@Type(() => TimeRangeDto)
	@IsOptional()
	@ValidateNested()
	createdTimeRange?: TimeRangeDto;

	@IsEnum(ExamStatus)
	@IsOptional()
	status?: ExamStatus;

	@IsOptional()
	@IsString()
	title?: string;

	@Type(() => TimeRangeDto)
	@IsOptional()
	@ValidateNested()
	updatedTimeRange?: TimeRangeDto;
}

class SortOptionsDto implements exam.FindExamsManagementDto_SortOption {
	@IsEnum(SortDirection)
	direction!: SortDirection;

	@IsIn(['updatedAt', 'createdAt'])
	@IsString()
	key!: 'updatedAt' | 'createdAt';
}

export class FindExamsForManagentDto implements exam.FindExamsManagementDto {
	@IsOptional()
	@IsString()
	cursor?: string;

	@Type(() => FilterOptionsDto)
	@IsOptional()
	@ValidateNested()
	filter?: FilterOptionsDto;

	@IsInt()
	@IsOptional()
	limit?: number;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	sortBy?: SortOptionsDto;
}
