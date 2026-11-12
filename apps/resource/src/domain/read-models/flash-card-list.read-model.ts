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
}

export interface FlashCardListDetailReadModel extends FlashCardListReadModel {
	flashCards: FlashCardReadModel[];
	totalCards: number;
}

export interface FlashCardListsPageReadModel {
	lists: FlashCardListReadModel[];
	totalCount: number;
}
