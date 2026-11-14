import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';

/** Resource types the authorization service tracks ownership for. */
export type OwnedResourceType = 'blog' | 'flashcard';

export interface ReportStatusChangedEvent {
	reportId: string;
	reportedBy: string;
	status: string;
	title: string;
}

export interface ReportCreatedEvent {
	reportId: string;
	reportedBy: string;
	type: string;
	title: string;
	targetType: string | null;
	targetId: string | null;
}

/** A proposal to change a list (notification tells the list owner). */
export interface FlashCardProposalCreatedEvent {
	proposalId: string;
	targetListId: string;
	targetListName: string;
	targetOwnerId: string;
	authorId: string;
	title: string;
}

/** A proposal was accepted or rejected (notification tells the proposer). */
export interface FlashCardProposalDecidedEvent {
	proposalId: string;
	targetListId: string;
	targetListName: string;
	authorId: string;
	title: string;
	/** ACCEPTED | REJECTED */
	status: string;
	decidedBy: string;
	decisionNote: string | null;
}

/** A new comment on a blog post (notification tells the post author and the replied-to author). */
export interface BlogCommentCreatedEvent {
	commentId: string;
	blogId: string;
	blogTitle: string;
	blogAuthorId: string;
	authorId: string;
	/** Author of the comment this one answers (the one the user clicked "reply" on), if any. */
	parentAuthorId: string | null;
	excerpt: string;
}

/** A new reply in a forum thread (notification tells the thread author and the quoted author). */
export interface ForumReplyCreatedEvent {
	replyId: string;
	threadId: string;
	threadTitle: string;
	threadAuthorId: string;
	authorId: string;
	/** Author of the reply this one quotes, if any. */
	quotedAuthorId: string | null;
	excerpt: string;
	/** 1-based position of the reply in the thread (the frontend opens the page it is on). */
	position: number;
}

/**
 * Writes integration events to the outbox; the relay publishes them on the `eventbus` exchange.
 * Call these inside the `@Transactional()` method that writes the data they describe.
 */
@Injectable()
export class ResourceEventsPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async resourceCreated(
		resourceType: OwnedResourceType,
		resourceId: string,
		ownerId: string,
	): Promise<void> {
		await this.outbox.add('resource.resource.created', {
			resourceType: resourceType,
			resourceId: resourceId,
			ownerId: ownerId,
		});
	}

	async resourcesDeleted(resourceType: OwnedResourceType, resourceIds: string[]): Promise<void> {
		// Sequential: the outbox rows share one interactive transaction.
		for (const resourceId of resourceIds) {
			await this.outbox.add('resource.resource.deleted', {
				resourceType: resourceType,
				resourceId: resourceId,
			});
		}
	}

	/** A new report to review (notification tells the admins). */
	async reportCreated(event: ReportCreatedEvent): Promise<void> {
		await this.outbox.add('resource.report.created', event);
	}

	async flashCardProposalCreated(event: FlashCardProposalCreatedEvent): Promise<void> {
		await this.outbox.add('resource.flashcard-proposal.created', event);
	}

	async flashCardProposalDecided(event: FlashCardProposalDecidedEvent): Promise<void> {
		await this.outbox.add('resource.flashcard-proposal.decided', event);
	}

	async reportStatusChanged(event: ReportStatusChangedEvent): Promise<void> {
		await this.outbox.add('resource.report.status-changed', event);
	}

	async blogCommentCreated(event: BlogCommentCreatedEvent): Promise<void> {
		await this.outbox.add('resource.blog-comment.created', event);
	}

	async forumReplyCreated(event: ForumReplyCreatedEvent): Promise<void> {
		await this.outbox.add('resource.forum-reply.created', event);
	}
}
