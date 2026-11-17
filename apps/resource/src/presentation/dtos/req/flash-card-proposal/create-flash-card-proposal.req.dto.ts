import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFlashCardProposalReqDto
	extends RequesterReqDto
	implements resource.CreateFlashCardProposalRequest
{
	@IsString()
	sourceListId!: string;

	@IsNotEmpty()
	@IsString()
	@MaxLength(200)
	title!: string;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	message?: string;
}
