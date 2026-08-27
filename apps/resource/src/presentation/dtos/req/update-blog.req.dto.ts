import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBlogReqDto implements resource.UpdateBlogRequest {
	@IsString()
	id!: string | undefined;

	@IsOptional()
	@IsString()
	title?: string | undefined;

	@IsOptional()
	@IsString()
	content?: string | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
