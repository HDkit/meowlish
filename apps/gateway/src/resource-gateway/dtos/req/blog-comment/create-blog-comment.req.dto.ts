import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBlogCommentDto implements Omit<
	resource.CreateBlogCommentRequest,
	'blogId' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(5000)
	@ApiProperty({ maxLength: 5000, description: 'Markdown' })
	content!: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Comment being replied to; top-level when omitted' })
	parentId?: string;
}
