import { ApiProperty } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateForumReplyDto implements Omit<
	resource.UpdateForumReplyRequest,
	'id' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsString()
	@MaxLength(20000)
	@ApiProperty({ maxLength: 20000, description: 'Markdown' })
	body!: string;
}
