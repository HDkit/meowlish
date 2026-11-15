export interface FlashCardReadModel {
	id: string;
	word: string;
	definition: string;
	/** URL to show: the image file's URL when there is one, else the legacy free URL. */
	image?: string;
	/** The image file (file-service id); `image` is resolved from it (`CardImageUrlService`). */
	imageFileId?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	authorId: string;
	tags: string[];
	/** 0-based place in its list; absent until the card is placed (see `CARD_ORDER`). */
	position?: number;
	createdAt: string;
	updatedAt: string;
}

export interface FlashCardListPageReadModel {
	flashCards: FlashCardReadModel[];
	totalCount: number;
}
