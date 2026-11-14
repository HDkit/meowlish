import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString, MaxLength } from 'class-validator';

export class CreateForumThreadReqDto
	extends RequesterReqDto
	implements resource.CreateForumThreadRequest
{
	@IsString()
	categoryId!: string;

	@IsString()
	@MaxLength(200)
	title!: string;

	@IsString()
	@MaxLength(20000)
	body!: string;
}
