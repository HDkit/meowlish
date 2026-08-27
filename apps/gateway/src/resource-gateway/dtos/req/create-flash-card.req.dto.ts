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

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	listId?: string;
}
