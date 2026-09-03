import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class FlashCardDto implements resource.FlashCardResponse {
	@Expose()
	id!: string;

	@Expose()
	word!: string;

	@Expose()
	definition!: string;

	@Expose()
	image?: string;

	@Expose()
	partOfSpeech?: string;

	@Expose()
	pronunciation?: string;

	@Expose()
	examples!: string[];

	@Expose()
	notes?: string;

	@Expose()
	authorId!: string;

	@Expose()
	tags!: string[];

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class ListFlashCardsDto implements resource.ListFlashCardsResponse {
	@Expose()
	@Type(() => FlashCardDto)
	flashCards!: FlashCardDto[];

	@Expose()
	totalCount!: number;
}
