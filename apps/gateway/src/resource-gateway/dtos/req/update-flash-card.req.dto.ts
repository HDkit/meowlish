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
	@ApiPropertyOptional()
	image?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	partOfSpeech?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	pronunciation?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	examples?: string[];

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	notes?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	tags?: string[];
}
