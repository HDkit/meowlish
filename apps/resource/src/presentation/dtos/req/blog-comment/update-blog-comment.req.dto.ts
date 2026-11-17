import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString, MaxLength } from 'class-validator';

export class UpdateBlogCommentReqDto
	extends RequesterReqDto
	implements resource.UpdateBlogCommentRequest
{
	@IsString()
	id!: string;

	@IsString()
	@MaxLength(5000)
	content!: string;
}
