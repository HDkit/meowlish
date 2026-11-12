import { QuestionType } from '../../../../enums/question-type.enum';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	ValidateNested,
} from 'class-validator';

class AddChoiceDto implements exam.UpdateQuestionDto_AddChoice {
	@IsString()
	key!: string;

	@IsOptional()
	@IsString()
	content?: string;

	@IsBoolean()
	isCorrect!: boolean;
}

class UpdateChoiceDto implements exam.UpdateQuestionDto_UpdateChoice {
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	key?: string;

	@IsOptional()
	@IsString()
	content?: string;

	@IsBoolean()
	@IsOptional()
	isCorrect?: boolean;

	@IsBoolean()
	@IsOptional()
	setContentNull?: boolean;
}

export class UpdateQuestionDto implements exam.UpdateQuestionDto {
	@Type(() => AddChoiceDto)
	@IsArray()
	@IsOptional()
	@ValidateNested({ each: true })
	addChoices!: AddChoiceDto[];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	deleteChoicesIds!: string[];

	@Type(() => UpdateChoiceDto)
	@IsArray()
	@IsOptional()
	@ValidateNested({ each: true })
	updateChoices!: UpdateChoiceDto[];

	@IsOptional()
	@IsString()
	content?: string;

	@IsOptional()
	@IsString()
	explanation?: string;

	@IsString()
	id!: string;

	@IsInt()
	@IsOptional()
	@IsPositive()
	points?: number;

	@IsEnum(QuestionType)
	@IsOptional()
	type?: QuestionType;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ArrayUnique()
	addTags!: string[];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ArrayUnique()
	removeTags!: string[];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ArrayUnique()
	addFiles!: string[];

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ArrayUnique()
	removeFiles!: string[];

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
