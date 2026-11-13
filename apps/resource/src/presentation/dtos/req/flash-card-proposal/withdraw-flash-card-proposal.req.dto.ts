import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class WithdrawFlashCardProposalReqDto
	extends RequesterReqDto
	implements resource.WithdrawFlashCardProposalRequest
{
	@IsString()
	id!: string;
}
