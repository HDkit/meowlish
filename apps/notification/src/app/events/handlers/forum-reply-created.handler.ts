import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { NotificationService } from '../../services/notification.service';
import { discussionRecipients } from './discussion-recipients';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FORUM_REPLY_CREATED_QUEUE = defineConsumerQueue(
	'notification.events.forum-reply.created',
);

/** Replies per page of the frontend's thread view (`REPLIES_PER_PAGE` in its `lib/forum.ts`). */
const REPLIES_PER_PAGE = 20;

class ForumReplyCreatedEvent {
	@IsString() replyId!: string;
	@IsString() threadId!: string;
	@IsString() threadTitle!: string;
	@IsString() threadAuthorId!: string;
	@IsString() authorId!: string;
	@IsOptional() @IsString() quotedAuthorId?: string | null;
	@IsString() excerpt!: string;
	@IsInt() @Min(1) position!: number;
}

/** In-app path of a reply: the thread page it is on, scrolled to `#reply-<id>`. */
export const forumReplyAction = (threadId: string, replyId: string, position: number): string => {
	const page = Math.ceil(position / REPLIES_PER_PAGE);
	const query = page > 1 ? `?page=${page}` : '';
	return `/forum/thread/${encodeURIComponent(threadId)}${query}#reply-${encodeURIComponent(replyId)}`;
};

/** Tells the thread author about a new reply, and the quoted reply's author about the quote. */
@Injectable()
export class ForumReplyCreatedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly preferencesService: NotificationPreferencesService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.forum-reply.created',
		...FORUM_REPLY_CREATED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FORUM_REPLY_CREATED_QUEUE.name))) return;
		const event = await validatePayload(ForumReplyCreatedEvent, payload);

		const recipients = discussionRecipients(
			event.authorId,
			{ id: event.threadAuthorId, preference: 'forumReply' },
			{ id: event.quotedAuthorId ?? null, preference: 'commentReply' },
		);
		for (const recipient of recipients) {
			if (!(await this.preferencesService.isEnabled(recipient.id, recipient.preference))) continue;
			const quoted = recipient.kind === 'replied';
			await this.notificationService.createNotification({
				recipientId: recipient.id,
				type: quoted ? 'comment_reply' : 'forum_reply',
				title: quoted ? 'Có người trả lời bình luận của bạn' : 'Chủ đề của bạn có trả lời mới',
				message: `Trong chủ đề "${event.threadTitle}": ${event.excerpt}`,
				data: JSON.stringify({
					threadId: event.threadId,
					replyId: event.replyId,
					action: forumReplyAction(event.threadId, event.replyId, event.position),
				}),
			});
		}
	}
}
