import { resource } from '@server/generated';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBlogReqDto implements resource.UpdateBlogRequest {
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	title?: string;

	@IsOptional()
	@IsString()
	content?: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
