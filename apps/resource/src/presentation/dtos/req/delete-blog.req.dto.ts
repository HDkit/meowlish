import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteBlogReqDto implements resource.DeleteBlogRequest {
	@IsString()
	id!: string;
}
