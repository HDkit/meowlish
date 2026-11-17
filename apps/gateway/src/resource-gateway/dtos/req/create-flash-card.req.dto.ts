import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardDto {
	@IsString()
	@ApiProperty()
	word!: string;

	@IsString()
	@ApiProperty()
	definition!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description:
			'Image of the card: the id of a file you uploaded (POST /files with isPublicFile: true). Image URLs are no longer accepted.',
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

	@IsString()
	@ApiProperty({ description: 'List the card belongs to; must be one of your own lists' })
	listId!: string;
}
