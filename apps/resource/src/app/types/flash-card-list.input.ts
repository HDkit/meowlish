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
}

export interface ListFlashCardListsInput extends PageInput {
	authorId?: string;
	isPublic?: boolean;
	tags: string[];
}

export interface ListCardsInListInput extends PageInput {
	listId: string;
}
