import { ApiProperty } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateBlogCommentDto implements Omit<
	resource.UpdateBlogCommentRequest,
	'id' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(5000)
	@ApiProperty({ maxLength: 5000, description: 'Markdown' })
	content!: string;
}
