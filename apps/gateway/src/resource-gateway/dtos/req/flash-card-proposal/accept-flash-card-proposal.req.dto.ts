import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class ProposalConflictResolutionDto implements resource.ProposalConflictResolution {
	@IsString()
	@ApiProperty({ description: 'A conflicting card of your list' })
	targetCardId!: string;

	@IsBoolean()
	@ApiProperty({ description: "true: apply the proposal's version; false: keep yours" })
	apply!: boolean;
}

export class AcceptFlashCardProposalDto implements Omit<
	resource.AcceptFlashCardProposalRequest,
	'id' | 'resolutions' | 'requesterId' | 'privileged'
> {
	@Type(() => ProposalConflictResolutionDto)
	@IsArray()
	@IsOptional()
	@ValidateNested({ each: true })
	@ApiPropertyOptional({
		type: () => [ProposalConflictResolutionDto],
		description: 'One choice per conflicting card (cards you changed since the proposal)',
	})
	resolutions?: ProposalConflictResolutionDto[];

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@ApiPropertyOptional({ maxLength: 2000 })
	decisionNote?: string;
}
