import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardReqDto implements resource.CreateFlashCardRequest {
	@IsString()
	word!: string;

	@IsString()
	definition!: string;

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

	@IsString()
	authorId!: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

	@IsOptional()
	@IsString()
	listId!: string;
}
