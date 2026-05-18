import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardReqDto implements resource.UpdateFlashCardRequest {
	@IsString()
	id!: string | undefined;

	@IsOptional()
	@IsString()
	word?: string | undefined;

	@IsOptional()
	@IsString()
	definition?: string | undefined;

	@IsOptional()
	@IsString()
	image?: string | undefined;

	@IsOptional()
	@IsString()
	partOfSpeech?: string | undefined;

	@IsOptional()
	@IsString()
	pronunciation?: string | undefined;

	@IsArray()
	@IsString({ each: true })
	examples!: string[];

	@IsOptional()
	@IsString()
	notes?: string | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
