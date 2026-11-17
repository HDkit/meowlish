import { PageQueryDto } from '../page.query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { FlashCardProposalStatus } from '@server/typing';
import { str2bool } from '@server/utils';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class ListFlashCardProposalsQueryDto
	extends PageQueryDto
	implements Omit<resource.ListFlashCardProposalsRequest, 'requesterId' | 'privileged'>
{
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Proposals to this list (the original)' })
	targetListId?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Proposals from this list (your copy)' })
	sourceListId?: string;

	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? (str2bool(value) ?? value) : value,
	)
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ type: Boolean, description: 'Only proposals you made' })
	mine?: boolean;

	@IsEnum(FlashCardProposalStatus)
	@IsOptional()
	@ApiPropertyOptional({ enum: FlashCardProposalStatus })
	status?: FlashCardProposalStatus;
}
