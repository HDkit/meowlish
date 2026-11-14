import { ApiPropertyOptional } from '@nestjs/swagger';
import { notification } from '@server/generated';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesReqDto implements Omit<
	notification.UpdatePreferencesRequest,
	'identityId'
> {
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	emailEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	pushEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	achievementEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	reportEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	systemEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ description: 'Someone commented on my blog post' })
	blogCommentEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({
		description: 'Someone replied to my blog comment or quoted my forum reply',
	})
	commentReplyEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional({ description: 'Someone replied in my forum thread' })
	forumReplyEnabled?: boolean;
}
