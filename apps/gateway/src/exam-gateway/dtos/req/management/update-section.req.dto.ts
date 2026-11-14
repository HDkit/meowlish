import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { ArrayUnique, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSectionDto implements Omit<
	exam.UpdateSectionDto,
	'id' | 'requesterId' | 'privileged'
> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	contentType?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	directive?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	name?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setNameNull?: boolean;

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Ids of tags (not names) to add to the section',
		type: [String],
	})
	@ArrayUnique()
	addTags: string[] = [];

	@IsArray()
	@IsString({ each: true })
	@ApiProperty({
		description: 'Ids of tags (not names) to remove from the section',
		type: [String],
	})
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
