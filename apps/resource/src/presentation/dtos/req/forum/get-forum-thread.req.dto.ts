import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetForumThreadReqDto implements resource.GetForumThreadRequest {
	@IsString()
	id!: string;
}
