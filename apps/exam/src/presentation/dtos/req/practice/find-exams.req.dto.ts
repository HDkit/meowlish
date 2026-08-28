import { exam } from '@server/generated';
import { SortDirection } from '@server/typing';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsEnum,
	IsIn,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
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
}

class SortOptionsDto implements exam.FindExamsDto_SortOption {
	@IsIn(['attemptsCount', 'updatedAt'])
	key!: 'attemptsCount' | 'updatedAt';

	@IsEnum(SortDirection)
	direction!: SortDirection;
}

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

	@IsNumber()
	@IsOptional()
	@IsPositive()
	limit?: number;
}
