import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateFlashCardListReqDto implements resource.CreateFlashCardListRequest {
	@IsString()
	name!: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsString()
	authorId!: string;

	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
