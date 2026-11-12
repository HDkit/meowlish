import { exam } from '@server/generated';
import { ArrayUnique, IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateExamDto implements exam.UpdateExamDto {
	@IsOptional()
	@IsString()
	description?: string;

	@IsNumber()
	@IsOptional()
	duration?: number;

	@IsString()
	id!: string;

	@IsBoolean()
	@IsOptional()
	setDescriptionNull?: boolean;

	@IsOptional()
	@IsString()
	title?: string;

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

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
