import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteBlogCommentReqDto
	extends RequesterReqDto
	implements resource.DeleteBlogCommentRequest
{
	@IsString()
	id!: string;
}
