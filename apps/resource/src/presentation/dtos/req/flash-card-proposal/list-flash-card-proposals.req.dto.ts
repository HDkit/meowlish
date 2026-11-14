import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { FlashCardProposalStatus } from '@server/typing';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListFlashCardProposalsReqDto
	extends RequesterReqDto
	implements resource.ListFlashCardProposalsRequest
{
	@IsOptional()
	@IsString()
	targetListId?: string;

	@IsOptional()
	@IsString()
	sourceListId?: string;

	@IsBoolean()
	@IsOptional()
	mine?: boolean;

	@IsEnum(FlashCardProposalStatus)
	@IsOptional()
	status?: FlashCardProposalStatus;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(100)
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(100)
	@Min(1)
	limit?: number;
}
