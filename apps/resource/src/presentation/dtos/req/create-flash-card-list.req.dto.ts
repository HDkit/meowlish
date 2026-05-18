import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardListReqDto implements resource.CreateFlashCardListRequest {
	@IsString()
	name!: string | undefined;

	@IsOptional()
	@IsString()
	description?: string | undefined;

	@IsString()
	authorId!: string | undefined;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
