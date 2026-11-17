import { NotificationService } from '../../services/notification.service';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FLASHCARD_PROPOSAL_WITHDRAWN_QUEUE = defineConsumerQueue(
	'notification.events.flashcard-proposal.withdrawn',
);

class FlashCardProposalWithdrawnEvent {
	@IsString() proposalId!: string;
	@IsString() targetListId!: string;
	@IsString() targetOwnerId!: string;
	@IsString() authorId!: string;
}

/**
 * The proposer withdrew a proposal: the list owner's "proposal waiting for review" notification is
 * no longer true, so it is deleted (read or not), which also drops it from the unread count.
 */
@Injectable()
export class FlashCardProposalWithdrawnHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.flashcard-proposal.withdrawn',
		...FLASHCARD_PROPOSAL_WITHDRAWN_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FLASHCARD_PROPOSAL_WITHDRAWN_QUEUE.name))) return;
		const event = await validatePayload(FlashCardProposalWithdrawnEvent, payload);
		await this.notificationService.deleteProposalNotifications(
			event.targetOwnerId,
			event.proposalId,
		);
	}
}
