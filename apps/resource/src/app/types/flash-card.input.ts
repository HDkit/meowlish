import { type PageInput } from './pagination';

export interface CreateFlashCardInput {
	word: string;
	definition: string;
	/** An uploaded file shown as the image; must be `authorId`'s upload unless `mayAttachAnyFile`. */
	imageFileId?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	authorId: string;
	tags: string[];
	listId: string;
	/** Admins may attach files someone else uploaded (decided by the gateway). */
	mayAttachAnyFile?: boolean;
}

export interface UpdateFlashCardInput {
	id: string;
	word?: string;
	definition?: string;
	/** Absent: keep the image. '': remove it (a legacy URL too). Else the new image file. */
	imageFileId?: string;
	partOfSpeech?: string;
	pronunciation?: string;
	examples: string[];
	notes?: string;
	tags: string[];
	/** `examples` / `tags` were sent: replace the list, even with an empty one. */
	replaceExamples?: boolean;
	replaceTags?: boolean;
	/** Admins may attach files someone else uploaded (decided by the gateway). */
	mayAttachAnyFile?: boolean;
}

export interface ListFlashCardsInput extends PageInput {
	authorId?: string;
	tags: string[];
}
