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

	@Expose()
	forkedFromId?: string;

	@Expose()
	forkedFromName?: string;

	@Expose()
	forkedFromAuthorId?: string;

	@Expose()
	forkCount!: number;
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
	forkedFromId?: string;

	@Expose()
	forkedFromName?: string;

	@Expose()
	forkedFromAuthorId?: string;

	@Expose()
	forkCount!: number;

	@Expose()
	@Type(() => FlashCardDto)
	flashCards!: FlashCardDto[];

	@Expose()
	totalCards!: number;

	@Expose()
	openProposalCount!: number;

	@Expose()
	upstreamAvailable!: boolean;
}

export class ListFlashCardListsDto implements resource.ListFlashCardListsResponse {
	@Expose()
	@Type(() => FlashCardListDto)
	lists!: FlashCardListDto[];

	@Expose()
	totalCount!: number;
}
