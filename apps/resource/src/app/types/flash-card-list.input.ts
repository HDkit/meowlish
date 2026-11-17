import { type PageInput } from './pagination';

export interface CreateFlashCardListInput {
	name: string;
	description?: string;
	authorId: string;
	isPublic?: boolean;
	tags: string[];
}

export interface UpdateFlashCardListInput {
	id: string;
	name?: string;
	description?: string;
	isPublic?: boolean;
	tags: string[];
	/** `tags` was sent: replace the list, even with an empty one. */
	replaceTags?: boolean;
}

export interface ListFlashCardListsInput extends PageInput {
	authorId?: string;
	isPublic?: boolean;
	tags: string[];
	/** Case-insensitive substring of the list name. */
	name?: string;
}

export interface ListCardsInListInput extends PageInput {
	listId: string;
}
