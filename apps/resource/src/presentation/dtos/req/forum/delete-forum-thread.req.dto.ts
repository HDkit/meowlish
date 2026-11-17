import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteForumThreadReqDto
	extends RequesterReqDto
	implements resource.DeleteForumThreadRequest
{
	@IsString()
	id!: string;
}
