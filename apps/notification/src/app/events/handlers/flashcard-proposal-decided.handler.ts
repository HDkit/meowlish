import { NotificationService } from '../../services/notification.service';
import { proposalAction } from './flashcard-proposal-created.handler';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { FlashCardProposalStatus } from '@server/typing';
import { validatePayload } from '@server/utils';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const FLASHCARD_PROPOSAL_DECIDED_QUEUE = defineConsumerQueue(
	'notification.events.flashcard-proposal.decided',
);

class FlashCardProposalDecidedEvent {
	@IsString() proposalId!: string;
	@IsString() targetListId!: string;
	@IsString() targetListName!: string;
	@IsString() authorId!: string;
	@IsString() title!: string;
	@IsEnum(FlashCardProposalStatus) status!: FlashCardProposalStatus;
	@IsString() decidedBy!: string;
	@IsOptional() @IsString() decisionNote?: string | null;
}

/** The notification a proposer gets when the list owner accepts or rejects their proposal. */
export const proposalDecisionText = (event: {
	title: string;
	targetListName: string;
	status: FlashCardProposalStatus;
	decisionNote?: string | null;
}): { title: string; message: string } | null => {
	const subject = `Đề xuất "${event.title}" cho bộ thẻ "${event.targetListName}"`;
	const note = event.decisionNote?.trim() ? ` Ghi chú: ${event.decisionNote.trim()}` : '';
	switch (event.status) {
		case FlashCardProposalStatus.Accepted:
			return {
				title: 'Đề xuất của bạn đã được chấp nhận',
				message: `${subject} đã được chấp nhận và áp dụng.${note}`,
			};
		case FlashCardProposalStatus.Rejected:
			return {
				title: 'Đề xuất của bạn đã bị từ chối',
				message: `${subject} đã bị từ chối.${note}`,
			};
		default:
			return null;
	}
};

/** Tells a proposer that the list owner accepted or rejected their proposal. */
@Injectable()
export class FlashCardProposalDecidedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.flashcard-proposal.decided',
		...FLASHCARD_PROPOSAL_DECIDED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, FLASHCARD_PROPOSAL_DECIDED_QUEUE.name))) return;
		const event = await validatePayload(FlashCardProposalDecidedEvent, payload);
		const text = proposalDecisionText(event);
		if (!text || event.decidedBy === event.authorId) return;
		await this.notificationService.createNotification({
			recipientId: event.authorId,
			type: 'flashcard',
			title: text.title,
			message: text.message,
			data: JSON.stringify({
				proposalId: event.proposalId,
				listId: event.targetListId,
				status: event.status,
				action: proposalAction(event.targetListId, event.proposalId),
			}),
		});
	}
}
