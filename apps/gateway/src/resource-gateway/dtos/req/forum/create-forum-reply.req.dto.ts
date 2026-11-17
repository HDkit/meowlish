import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateForumReplyDto implements Omit<
	resource.CreateForumReplyRequest,
	'threadId' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(20000)
	@ApiProperty({ maxLength: 20000, description: 'Markdown' })
	body!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Reply of the same thread being quoted' })
	quotedReplyId?: string;
}
