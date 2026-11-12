import { type PageInput } from './pagination';

export interface CreateFlashCardInput {
	word: string;
	definition: string;
	image?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	authorId: string;
	tags: string[];
	listId: string;
}

export interface UpdateFlashCardInput {
	id: string;
	word?: string;
	definition?: string;
	image?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	tags: string[];
}

export interface ListFlashCardsInput extends PageInput {
	authorId?: string;
	tags: string[];
}
