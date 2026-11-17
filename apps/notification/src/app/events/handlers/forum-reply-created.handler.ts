import { type NotificationReadModel } from '../../../domain/read-models/notification.read-model';
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

/**
 * In-app path of a reply. It does not depend on the page size: the frontend finds the page from
 * `data.position` (1-based, oldest first) and scrolls to the reply.
 */
export const forumReplyAction = (threadId: string, replyId: string): string =>
	`/forum/thread/${encodeURIComponent(threadId)}?reply=${encodeURIComponent(replyId)}`;

/** Tells the thread author about a new reply (`forum_reply`), and the quoted reply's author about the quote (`forum_quote`). */
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
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		// pushed over SSE only after the commit: a rolled-back delivery must push nothing
		this.notificationService.push(await this.store(message));
	}

	/** Claims the event and stores its notifications, in one transaction. */
	@Transactional()
	private async store(message: unknown): Promise<NotificationReadModel[]> {
		const created: NotificationReadModel[] = [];
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FORUM_REPLY_CREATED_QUEUE.name))) return created;
		const event = await validatePayload(ForumReplyCreatedEvent, payload);

		const recipients = discussionRecipients(
			event.authorId,
			{ id: event.threadAuthorId, preference: 'forumReply' },
			{ id: event.quotedAuthorId ?? null, preference: 'forumQuote' },
		);
		for (const recipient of recipients) {
			if (!(await this.preferencesService.isEnabled(recipient.id, recipient.preference))) continue;
			const quoted = recipient.kind === 'replied';
			created.push(
				await this.notificationService.createNotification({
					recipientId: recipient.id,
					type: quoted ? 'forum_quote' : 'forum_reply',
					title: quoted ? 'Có người trích dẫn trả lời của bạn' : 'Chủ đề của bạn có trả lời mới',
					message: `Trong chủ đề "${event.threadTitle}": ${event.excerpt}`,
					data: JSON.stringify({
						threadId: event.threadId,
						replyId: event.replyId,
						position: event.position,
						action: forumReplyAction(event.threadId, event.replyId),
					}),
				}),
			);
		}
		return created;
	}
}
