import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString, MaxLength } from 'class-validator';

export class UpdateForumReplyReqDto
	extends RequesterReqDto
	implements resource.UpdateForumReplyRequest
{
	@IsString()
	id!: string;

	@IsString()
	@MaxLength(20000)
	body!: string;
}
