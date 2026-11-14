import { type NotificationReadModel } from '../../../domain/read-models/notification.read-model';
import { NotificationService } from '../../services/notification.service';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FLASHCARD_PROPOSAL_CREATED_QUEUE = defineConsumerQueue(
	'notification.events.flashcard-proposal.created',
);

class FlashCardProposalCreatedEvent {
	@IsString() proposalId!: string;
	@IsString() targetListId!: string;
	@IsString() targetListName!: string;
	@IsString() targetOwnerId!: string;
	@IsString() authorId!: string;
	@IsString() title!: string;
}

/** In-app path of a proposal (the frontend opens it on click). */
export const proposalAction = (targetListId: string, proposalId: string): string =>
	`/flashcards/${encodeURIComponent(targetListId)}/proposals/${encodeURIComponent(proposalId)}`;

/** Tells a list owner that someone proposed changes to their flash card list. */
@Injectable()
export class FlashCardProposalCreatedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.flashcard-proposal.created',
		...FLASHCARD_PROPOSAL_CREATED_QUEUE.subscribe,
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
		if (!(await this.inbox.claim(id, FLASHCARD_PROPOSAL_CREATED_QUEUE.name))) return created;
		const event = await validatePayload(FlashCardProposalCreatedEvent, payload);
		if (event.targetOwnerId === event.authorId) return created;
		created.push(
			await this.notificationService.createNotification({
				recipientId: event.targetOwnerId,
				type: 'flashcard',
				title: 'Có đề xuất thay đổi cho bộ thẻ của bạn',
				message: `Đề xuất "${event.title}" cho bộ thẻ "${event.targetListName}" đang chờ bạn xem xét.`,
				data: JSON.stringify({
					proposalId: event.proposalId,
					listId: event.targetListId,
					action: proposalAction(event.targetListId, event.proposalId),
				}),
			}),
		);
		return created;
	}
}
