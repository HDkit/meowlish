import { resource } from '@server/generated';
import { IsArray, IsString } from 'class-validator';

export class CreateBlogReqDto implements resource.CreateBlogRequest {
	@IsString()
	title!: string;

	@IsString()
	content!: string;

	@IsString()
	authorId!: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
