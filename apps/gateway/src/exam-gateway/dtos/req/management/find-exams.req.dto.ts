import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

class TimeRangeDto implements exam.FindExamsManagementDto_TimeRange {
	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	from!: Date;

	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	to!: Date;
}

class FilterOptionsDto implements exam.FindExamsManagementDto_FilterOption {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	createdBy?: string;

	@Type(() => TimeRangeDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => TimeRangeDto })
	createdTimeRange?: TimeRangeDto;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	status?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	title?: string;

	@Type(() => TimeRangeDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => TimeRangeDto })
	updatedTimeRange?: TimeRangeDto;
}

class SortOptionsDto implements exam.FindExamsManagementDto_SortOption {
	@IsEnum(SortDirection)
	@ApiProperty({ enum: SortDirection })
	direction!: SortDirection;

	@IsIn(['updatedAt', 'createdAt'])
	@IsString()
	@ApiProperty({ enum: ['updatedAt', 'createdAt'] })
	key!: 'updatedAt' | 'createdAt';
}

export class FindExamsForManagentDto implements exam.FindExamsManagementDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => FilterOptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => FilterOptionsDto })
	filter?: FilterOptionsDto;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@ApiPropertyOptional({ type: Number })
	limit?: number;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => SortOptionsDto })
	sortBy?: SortOptionsDto;
}
