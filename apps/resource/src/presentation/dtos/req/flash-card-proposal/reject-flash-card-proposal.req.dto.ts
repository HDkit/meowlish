import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectFlashCardProposalReqDto
	extends RequesterReqDto
	implements resource.RejectFlashCardProposalRequest
{
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	decisionNote?: string;
}
