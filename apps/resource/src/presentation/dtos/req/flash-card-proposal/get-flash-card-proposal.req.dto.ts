import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetFlashCardProposalReqDto
	extends RequesterReqDto
	implements resource.GetFlashCardProposalRequest
{
	@IsString()
	id!: string;
}
