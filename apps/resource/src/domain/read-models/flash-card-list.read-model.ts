import { type FlashCardReadModel } from './flash-card.read-model';

export interface FlashCardListReadModel {
	id: string;
	name: string;
	description: string;
	authorId: string;
	isPublic: boolean;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	/** Set on a copy: the original list (absent once it is deleted). */
	forkedFromId?: string;
	forkedFromName?: string;
	forkedFromAuthorId?: string;
	forkCount: number;
}

export interface FlashCardListDetailReadModel extends FlashCardListReadModel {
	flashCards: FlashCardReadModel[];
	totalCards: number;
	/** Open proposals on this list, for its owner and admins (0 for everyone else). */
	openProposalCount: number;
	/** The original of this copy exists and the requester may see it. */
	upstreamAvailable: boolean;
}

export interface FlashCardListsPageReadModel {
	lists: FlashCardListReadModel[];
	totalCount: number;
}
