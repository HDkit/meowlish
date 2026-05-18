import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFlashCardListReqDto implements resource.UpdateFlashCardListRequest {
	@IsString()
	id!: string | undefined;

	@IsOptional()
	@IsString()
	name?: string | undefined;

	@IsOptional()
	@IsString()
	description?: string | undefined;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
