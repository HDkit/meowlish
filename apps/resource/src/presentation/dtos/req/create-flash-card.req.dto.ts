import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardReqDto implements resource.CreateFlashCardRequest {
	@IsString()
	word!: string;

	@IsString()
	definition!: string;

	/** An uploaded file (file-service id); '' on update removes the image. */
	@IsOptional()
	@IsString()
	imageFileId?: string;

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

	@IsBoolean()
	@IsOptional()
	mayAttachAnyFile?: boolean;
}
