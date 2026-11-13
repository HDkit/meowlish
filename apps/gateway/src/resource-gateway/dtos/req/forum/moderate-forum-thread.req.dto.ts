import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsBoolean, IsOptional } from 'class-validator';

export class ModerateForumThreadDto implements Omit<
	resource.ModerateForumThreadRequest,
	'id' | 'requesterId' | 'privileged'
> {
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ description: 'Keep the thread at the top of its category' })
	isPinned?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ description: 'Close the thread to new replies and edits' })
	isLocked?: boolean;
}
