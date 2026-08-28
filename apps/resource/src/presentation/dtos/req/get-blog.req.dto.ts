import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetBlogReqDto implements resource.GetBlogRequest {
	@IsString()
	id!: string;
}
