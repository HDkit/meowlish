import { resource } from '@server/generated';
import { IsArray, IsString } from 'class-validator';

export class CreateBlogReqDto implements resource.CreateBlogRequest {
	@IsString()
	title!: string | undefined;

	@IsString()
	content!: string | undefined;

	@IsString()
	authorId!: string | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];
}
