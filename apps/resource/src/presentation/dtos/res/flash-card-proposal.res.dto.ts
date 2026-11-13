import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class FlashCardContentDto implements resource.FlashCardContent {
	@Expose()
	word!: string;

	@Expose()
	definition!: string;

	@Expose()
	partOfSpeech?: string;

	@Expose()
	pronunciation?: string;

	@Expose()
	examples!: string[];

	@Expose()
	notes?: string;

	@Expose()
	tags!: string[];

	@Expose()
	image?: string;
}

export class AddedCardChangeDto implements resource.AddedCardChange {
	@Expose()
	sourceCardId!: string;

	@Expose()
	@Type(() => FlashCardContentDto)
	card!: FlashCardContentDto;
}

export class ModifiedCardChangeDto implements resource.ModifiedCardChange {
	@Expose()
	targetCardId!: string;

	@Expose()
	sourceCardId!: string;

	@Expose()
	fields!: string[];

	@Expose()
	@Type(() => FlashCardContentDto)
	base!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	proposed!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	current?: FlashCardContentDto;

	@Expose()
	conflict!: boolean;

	@Expose()
	targetMissing!: boolean;
}

export class RemovedCardChangeDto implements resource.RemovedCardChange {
	@Expose()
	targetCardId!: string;

	@Expose()
	@Type(() => FlashCardContentDto)
	base!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	current?: FlashCardContentDto;

	@Expose()
	conflict!: boolean;

	@Expose()
	targetMissing!: boolean;
}

export class FlashCardListChangesDto implements resource.FlashCardListChanges {
	@Expose()
	@Type(() => AddedCardChangeDto)
	added!: AddedCardChangeDto[];

	@Expose()
	@Type(() => ModifiedCardChangeDto)
	modified!: ModifiedCardChangeDto[];

	@Expose()
	@Type(() => RemovedCardChangeDto)
	removed!: RemovedCardChangeDto[];
}

export class FlashCardListDiffDto implements resource.FlashCardListDiffResponse {
	@Expose()
	sourceListId!: string;

	@Expose()
	targetListId!: string;

	@Expose()
	targetListName!: string;

	@Expose()
	targetOwnerId!: string;

	@Expose()
	@Type(() => FlashCardListChangesDto)
	changes!: FlashCardListChangesDto;

	@Expose()
	openProposalId?: string;
}

export class PullFlashCardListUpstreamDto implements resource.PullFlashCardListUpstreamResponse {
	@Expose()
	updated!: number;

	@Expose()
	added!: number;

	@Expose()
	removed!: number;

	@Expose()
	skipped!: number;
}

export class FlashCardProposalDto implements resource.FlashCardProposalResponse {
	@Expose()
	id!: string;

	@Expose()
	sourceListId?: string;

	@Expose()
	sourceListName?: string;

	@Expose()
	targetListId!: string;

	@Expose()
	targetListName!: string;

	@Expose()
	targetOwnerId!: string;

	@Expose()
	authorId!: string;

	@Expose()
	title!: string;

	@Expose()
	message!: string;

	@Expose()
	status!: string;

	@Expose()
	addedCount!: number;

	@Expose()
	modifiedCount!: number;

	@Expose()
	removedCount!: number;

	@Expose()
	decidedAt?: string;

	@Expose()
	decidedBy?: string;

	@Expose()
	decisionNote?: string;

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class FlashCardProposalDetailDto
	extends FlashCardProposalDto
	implements resource.FlashCardProposalDetailResponse
{
	@Expose()
	@Type(() => FlashCardListChangesDto)
	changes!: FlashCardListChangesDto;

	@Expose()
	conflictCount!: number;

	@Expose()
	canDecide!: boolean;

	@Expose()
	canWithdraw!: boolean;
}

export class ListFlashCardProposalsDto implements resource.ListFlashCardProposalsResponse {
	@Expose()
	@Type(() => FlashCardProposalDto)
	proposals!: FlashCardProposalDto[];

	@Expose()
	totalCount!: number;
}
