import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

class TimeRangeDto {
	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	from!: Date;

	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	to!: Date;
}

class FilterOptionsDto {
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

class SortOptionsDto {
	@IsEnum(SortDirection)
	@ApiProperty({ enum: SortDirection })
	direction!: SortDirection;

	@IsIn(['updatedAt', 'createdAt'])
	@IsString()
	@ApiProperty({ enum: ['updatedAt', 'createdAt'] })
	key!: 'updatedAt' | 'createdAt';
}

export class FindExamsForManagentDto {
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
