import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class NotificationPreferencesDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	identityId!: string;

	@Expose()
	@ApiProperty()
	emailEnabled!: boolean;

	@Expose()
	@ApiProperty()
	pushEnabled!: boolean;

	@Expose()
	@ApiProperty()
	achievementEnabled!: boolean;

	@Expose()
	@ApiProperty()
	reportEnabled!: boolean;

	@Expose()
	@ApiProperty()
	systemEnabled!: boolean;

	@Expose()
	@ApiProperty({ description: 'Someone commented on my blog post' })
	blogCommentEnabled!: boolean;

	@Expose()
	@ApiProperty({ description: 'Someone replied to my blog comment or quoted my forum reply' })
	commentReplyEnabled!: boolean;

	@Expose()
	@ApiProperty({ description: 'Someone replied in my forum thread' })
	forumReplyEnabled!: boolean;

	@Expose()
	@ApiProperty()
	updatedAt!: string;
}
