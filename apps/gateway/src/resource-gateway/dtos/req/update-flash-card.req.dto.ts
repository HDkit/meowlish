import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	word?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	definition?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description:
			"Absent: keep the image. Empty string: remove it (an old image URL too). Otherwise the id of a file you uploaded (POST /files with isPublicFile: true), or the card's current imageFileId.",
	})
	imageFileId?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	partOfSpeech?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	pronunciation?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	examples?: string[];

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	notes?: string;

	@IsArray()
	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
