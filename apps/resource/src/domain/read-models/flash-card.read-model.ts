export interface FlashCardReadModel {
	id: string;
	word: string;
	definition: string;
	image?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	authorId: string;
	tags: string[];
	createdAt: string;
	updatedAt: string;
}

export interface FlashCardListPageReadModel {
	flashCards: FlashCardReadModel[];
	totalCount: number;
}
