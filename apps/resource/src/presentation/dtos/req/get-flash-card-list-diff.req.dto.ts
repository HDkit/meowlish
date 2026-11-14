import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetFlashCardListDiffReqDto
	extends RequesterReqDto
	implements resource.GetFlashCardListDiffRequest
{
	@IsString()
	id!: string;
}
