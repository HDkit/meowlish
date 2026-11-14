import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateForumThreadDto implements Omit<
	resource.UpdateForumThreadRequest,
	'id' | 'requesterId' | 'privileged'
> {
	@IsNotEmpty()
	@IsOptional()
	@IsString()
	@MaxLength(200)
	@ApiPropertyOptional({ maxLength: 200 })
	title?: string;

	@IsNotEmpty()
	@IsOptional()
	@IsString()
	@MaxLength(20000)
	@ApiPropertyOptional({ maxLength: 20000, description: 'Markdown' })
	body?: string;
}
