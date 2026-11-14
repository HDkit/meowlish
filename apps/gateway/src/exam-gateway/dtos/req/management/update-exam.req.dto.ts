import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
} from 'class-validator';

export class UpdateExamDto implements Omit<
	exam.UpdateExamDto,
	'id' | 'requesterId' | 'privileged'
> {
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
	@ApiProperty({
		description: 'Ids of tags (not names) to add to the exam',
		type: [String],
	})
	@ArrayUnique()
	addTags: string[] = [];

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Ids of tags (not names) to remove from the exam',
		type: [String],
	})
	@ArrayUnique()
	removeTags: string[] = [];
}
