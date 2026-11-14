import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateForumReplyReqDto
	extends RequesterReqDto
	implements resource.CreateForumReplyRequest
{
	@IsString()
	threadId!: string;

	@IsString()
	@MaxLength(20000)
	body!: string;

	@IsOptional()
	@IsString()
	quotedReplyId?: string;
}
