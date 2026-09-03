import { FlashCardDto } from './flash-card.res.dto';
import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class FlashCardListDto implements resource.FlashCardListResponse {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	description!: string;

	@Expose()
	authorId!: string;

	@Expose()
	isPublic!: boolean;

	@Expose()
	tags!: string[];

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class FlashCardListDetailDto implements resource.FlashCardListDetailResponse {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	description!: string;

	@Expose()
	authorId!: string;

	@Expose()
	isPublic!: boolean;

	@Expose()
	tags!: string[];

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;

	@Expose()
	@Type(() => FlashCardDto)
	flashCards!: FlashCardDto[];

	@Expose()
	totalCards!: number;
}

export class ListFlashCardListsDto implements resource.ListFlashCardListsResponse {
	@Expose()
	@Type(() => FlashCardListDto)
	lists!: FlashCardListDto[];

	@Expose()
	totalCount!: number;
}
