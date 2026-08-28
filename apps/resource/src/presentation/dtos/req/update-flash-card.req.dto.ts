import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardReqDto implements resource.UpdateFlashCardRequest {
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	word?: string;

	@IsOptional()
	@IsString()
	definition?: string;

	@IsOptional()
	@IsString()
	image?: string;

	@IsOptional()
	@IsString()
	partOfSpeech?: string;

	@IsOptional()
	@IsString()
	pronunciation?: string;

	@IsArray()
	@IsString({ each: true })
	examples!: string[];

	@IsOptional()
	@IsString()
	notes?: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
