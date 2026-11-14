import { exam } from '@server/generated';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsEnum,
	IsIn,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	Max,
	ValidateNested,
} from 'class-validator';

class FilterOptionsDto implements exam.FindExamsDto_FilterOption {
	@IsOptional()
	@IsString()
	name?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	tags: string[] = [];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	requiredTags: string[] = [];
}

class SortOptionsDto implements exam.FindExamsDto_SortOption {
	@IsIn(['attemptsCount', 'updatedAt'])
	key!: 'attemptsCount' | 'updatedAt';

	@IsEnum(SortDirection)
	direction!: SortDirection;
}

const MAX_PAGE_LIMIT = 100;

export class FindExamsDto implements exam.FindExamsDto {
	@Type(() => FilterOptionsDto)
	@IsOptional()
	@ValidateNested()
	filter?: FilterOptionsDto;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	sortBy?: SortOptionsDto;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(MAX_PAGE_LIMIT)
	limit?: number;

	@IsInt()
	@IsOptional()
	@IsPositive()
	page?: number;
}
