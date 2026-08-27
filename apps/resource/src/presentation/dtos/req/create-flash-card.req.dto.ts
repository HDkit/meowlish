import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardReqDto implements resource.CreateFlashCardRequest {
	@IsString()
	word!: string | undefined;

	@IsString()
	definition!: string | undefined;

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

	@IsString()
	authorId!: string | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

	@IsOptional()
	@IsString()
	listId!: string | undefined;
}
