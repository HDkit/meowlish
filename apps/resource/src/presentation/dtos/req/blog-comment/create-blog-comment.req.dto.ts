import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlogCommentReqDto
	extends RequesterReqDto
	implements resource.CreateBlogCommentRequest
{
	@IsString()
	blogId!: string;

	@IsString()
	@MaxLength(5000)
	content!: string;

	@IsOptional()
	@IsString()
	parentId?: string;
}
