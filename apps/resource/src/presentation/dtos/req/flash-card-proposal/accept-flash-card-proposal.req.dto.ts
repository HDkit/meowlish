import { RequesterReqDto } from '../requester.req.dto';
import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';

export class ProposalConflictResolutionReqDto implements resource.ProposalConflictResolution {
	@IsString()
	targetCardId!: string;

	@IsBoolean()
	apply!: boolean;
}

export class AcceptFlashCardProposalReqDto
	extends RequesterReqDto
	implements resource.AcceptFlashCardProposalRequest
{
	@IsString()
	id!: string;

	@Type(() => ProposalConflictResolutionReqDto)
	@IsArray()
	@ValidateNested({ each: true })
	resolutions!: ProposalConflictResolutionReqDto[];

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	decisionNote?: string;
}
