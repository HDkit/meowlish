import { SectionType } from '../../../../enums/section-type.enum';
import { exam } from '@server/generated';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSectionDto implements exam.UpdateSectionDto {
	@IsEnum(SectionType)
	@IsOptional()
	contentType?: SectionType;

	@IsOptional()
	@IsString()
	directive?: string;

	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	name?: string;

	@IsBoolean()
	@IsOptional()
	setNameNull?: boolean;

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
