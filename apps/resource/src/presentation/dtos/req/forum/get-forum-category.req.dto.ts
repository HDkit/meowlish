import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetForumCategoryReqDto implements resource.GetForumCategoryRequest {
	@IsString()
	id!: string;
}
