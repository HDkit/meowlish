import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateForumThreadReqDto
	extends RequesterReqDto
	implements resource.UpdateForumThreadRequest
{
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsOptional()
	@IsString()
	@MaxLength(20000)
	body?: string;
}
