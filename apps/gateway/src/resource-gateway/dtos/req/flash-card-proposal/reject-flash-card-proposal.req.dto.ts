import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectFlashCardProposalDto implements Omit<
	resource.RejectFlashCardProposalRequest,
	'id' | 'requesterId' | 'privileged'
> {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@ApiPropertyOptional({ maxLength: 2000, description: 'Why the proposal was declined' })
	decisionNote?: string;
}
