import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
} from 'class-validator';

export class UpdateExamDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	description?: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	@ApiPropertyOptional({ type: Number })
	duration?: number;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setDescriptionNull?: boolean;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	title?: string;

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	@ArrayUnique()
	addTags: string[] = [];

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	@ArrayUnique()
	removeTags: string[] = [];
}
