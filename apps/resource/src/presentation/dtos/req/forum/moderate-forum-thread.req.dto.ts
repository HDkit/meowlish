import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ModerateForumThreadReqDto
	extends RequesterReqDto
	implements resource.ModerateForumThreadRequest
{
	@IsString()
	id!: string;

	@IsBoolean()
	@IsOptional()
	isPinned?: boolean;

	@IsBoolean()
	@IsOptional()
	isLocked?: boolean;
}
