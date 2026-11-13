import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class ForkFlashCardListReqDto
	extends RequesterReqDto
	implements resource.ForkFlashCardListRequest
{
	@IsString()
	id!: string;
}
