import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
	ValidateNested,
} from 'class-validator';

class FilterOptionsDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	name?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags: string[] = [];
}

class SortOptionsDto {
	@IsIn(['attemptsCount', 'updatedAt'])
	@ApiProperty({ enum: ['attemptsCount', 'updatedAt'] })
	key!: 'attemptsCount' | 'updatedAt';

	@IsEnum(SortDirection)
	@ApiProperty({ enum: SortDirection })
	direction!: SortDirection;
}

export class FindExamsDto {
	@Type(() => FilterOptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => FilterOptionsDto })
	filter?: FilterOptionsDto;

	@Type(() => SortOptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => SortOptionsDto })
	sortBy?: SortOptionsDto;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@IsPositive()
	@ApiPropertyOptional({ type: Number })
	limit?: number;
}
