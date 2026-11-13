import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFlashCardProposalDto implements Omit<
	resource.CreateFlashCardProposalRequest,
	'sourceListId' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(200)
	@ApiProperty({ maxLength: 200, example: 'Bổ sung ví dụ cho các từ chủ đề môi trường' })
	title!: string;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	@ApiPropertyOptional({ maxLength: 5000, description: 'Why the changes help (plain text)' })
	message?: string;
}
