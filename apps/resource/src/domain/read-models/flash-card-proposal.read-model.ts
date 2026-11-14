/** A card's editable content on the wire (absent instead of null). */
export interface CardContentReadModel {
	word: string;
	definition: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	tags: string[];
	image?: string;
}

export interface AddedCardChangeReadModel {
	sourceCardId: string;
	card: CardContentReadModel;
}

export interface ModifiedCardChangeReadModel {
	targetCardId: string;
	sourceCardId: string;
	fields: string[];
	base: CardContentReadModel;
	proposed: CardContentReadModel;
	current?: CardContentReadModel;
	conflict: boolean;
	targetMissing: boolean;
}

export interface RemovedCardChangeReadModel {
	targetCardId: string;
	base: CardContentReadModel;
	current?: CardContentReadModel;
	conflict: boolean;
	targetMissing: boolean;
}

export interface ListChangesReadModel {
	added: AddedCardChangeReadModel[];
	modified: ModifiedCardChangeReadModel[];
	removed: RemovedCardChangeReadModel[];
}

export interface FlashCardListDiffReadModel {
	sourceListId: string;
	targetListId: string;
	targetListName: string;
	targetOwnerId: string;
	changes: ListChangesReadModel;
	openProposalId?: string;
}

export interface PullUpstreamResultReadModel {
	updated: number;
	added: number;
	removed: number;
	skipped: number;
}

export interface FlashCardProposalReadModel {
	id: string;
	sourceListId?: string;
	sourceListName?: string;
	targetListId: string;
	targetListName: string;
	targetOwnerId: string;
	authorId: string;
	title: string;
	message: string;
	status: string;
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	decidedAt?: string;
	decidedBy?: string;
	decisionNote?: string;
	createdAt: string;
	updatedAt: string;
}

export interface FlashCardProposalDetailReadModel extends FlashCardProposalReadModel {
	changes: ListChangesReadModel;
	conflictCount: number;
	canDecide: boolean;
	canWithdraw: boolean;
}

export interface FlashCardProposalsPageReadModel {
	proposals: FlashCardProposalReadModel[];
	totalCount: number;
}
