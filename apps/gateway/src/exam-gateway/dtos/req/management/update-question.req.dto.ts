import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsInt,
	IsOptional,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';

class AddChoiceDto {
	@IsString()
	@ApiProperty()
	key!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	content?: string;

	@IsBoolean()
	@ApiProperty()
	isCorrect!: boolean;
}

class UpdateChoiceDto {
	@IsString()
	@ApiProperty()
	id!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	key?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	content?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	isCorrect?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setContentNull?: boolean;
}

export class UpdateQuestionDto {
	@Type(() => AddChoiceDto)
	@IsArray()
	@ValidateNested({ each: true })
	@ApiProperty({ type: () => [AddChoiceDto] })
	addChoices: AddChoiceDto[] = [];

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	deleteChoicesIds: string[] = [];

	@Type(() => UpdateChoiceDto)
	@IsArray()
	@ValidateNested({ each: true })
	@ApiProperty({ type: () => [UpdateChoiceDto] })
	updateChoices: UpdateChoiceDto[] = [];

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	content?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	explanation?: string;

	@IsInt()
	@IsOptional()
	@Min(0)
	@ApiPropertyOptional({ type: Number })
	points?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	type?: string;

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

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	@ArrayUnique()
	addFiles: string[] = [];

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({ type: [String] })
	@ArrayUnique()
	removeFiles: string[] = [];
}
