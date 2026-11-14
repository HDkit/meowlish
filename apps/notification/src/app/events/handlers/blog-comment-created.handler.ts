import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { NotificationService } from '../../services/notification.service';
import { discussionRecipients } from './discussion-recipients';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsOptional, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const BLOG_COMMENT_CREATED_QUEUE = defineConsumerQueue(
	'notification.events.blog-comment.created',
);

class BlogCommentCreatedEvent {
	@IsString() commentId!: string;
	@IsString() blogId!: string;
	@IsString() blogTitle!: string;
	@IsString() blogAuthorId!: string;
	@IsString() authorId!: string;
	@IsOptional() @IsString() parentAuthorId?: string | null;
	@IsString() excerpt!: string;
}

/** In-app path of a blog comment (the post page scrolls to `#comment-<id>`). */
export const blogCommentAction = (blogId: string, commentId: string): string =>
	`/blog/${encodeURIComponent(blogId)}#comment-${encodeURIComponent(commentId)}`;

/** Tells the post author about a new comment, and the comment's author about a reply. */
@Injectable()
export class BlogCommentCreatedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly preferencesService: NotificationPreferencesService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.blog-comment.created',
		...BLOG_COMMENT_CREATED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, BLOG_COMMENT_CREATED_QUEUE.name))) return;
		const event = await validatePayload(BlogCommentCreatedEvent, payload);

		const recipients = discussionRecipients(
			event.authorId,
			{ id: event.blogAuthorId, preference: 'blogComment' },
			{ id: event.parentAuthorId ?? null, preference: 'commentReply' },
		);
		for (const recipient of recipients) {
			if (!(await this.preferencesService.isEnabled(recipient.id, recipient.preference))) continue;
			const replied = recipient.kind === 'replied';
			await this.notificationService.createNotification({
				recipientId: recipient.id,
				type: replied ? 'comment_reply' : 'blog_comment',
				title: replied ? 'Có người trả lời bình luận của bạn' : 'Bài viết của bạn có bình luận mới',
				message: `Trong bài "${event.blogTitle}": ${event.excerpt}`,
				data: JSON.stringify({
					blogId: event.blogId,
					commentId: event.commentId,
					action: blogCommentAction(event.blogId, event.commentId),
				}),
			});
		}
	}
}
