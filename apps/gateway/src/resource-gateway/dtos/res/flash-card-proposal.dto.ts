import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlashCardProposalStatus } from '@server/typing';
import { Expose, Type } from 'class-transformer';

/** Fields a proposal compares and changes. */
const CARD_DIFF_FIELDS = [
	'word',
	'definition',
	'partOfSpeech',
	'pronunciation',
	'examples',
	'notes',
	'tags',
];

export class FlashCardContentDto {
	@Expose()
	@ApiProperty()
	word!: string;

	@Expose()
	@ApiProperty()
	definition!: string;

	@Expose()
	@ApiPropertyOptional()
	partOfSpeech?: string;

	@Expose()
	@ApiPropertyOptional()
	pronunciation?: string;

	@Expose()
	@ApiProperty({ type: [String] })
	examples!: string[];

	@Expose()
	@ApiPropertyOptional()
	notes?: string;

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];

	@Expose()
	@ApiPropertyOptional()
	image?: string;
}

export class AddedCardChangeDto {
	@Expose()
	@ApiProperty({ description: 'The card in the copy' })
	sourceCardId!: string;

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiProperty({ type: () => FlashCardContentDto })
	card!: FlashCardContentDto;
}

export class ModifiedCardChangeDto {
	@Expose()
	@ApiProperty({ description: 'The card in the original list' })
	targetCardId!: string;

	@Expose()
	@ApiProperty({ description: 'The card in the copy' })
	sourceCardId!: string;

	@Expose()
	@ApiProperty({ type: [String], enum: CARD_DIFF_FIELDS, description: 'Changed fields' })
	fields!: string[];

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiProperty({
		type: () => FlashCardContentDto,
		description: "The original card's values when the change was computed",
	})
	base!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiProperty({ type: () => FlashCardContentDto })
	proposed!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiPropertyOptional({
		type: () => FlashCardContentDto,
		description: 'On an open proposal: the original card now',
	})
	current?: FlashCardContentDto;

	@Expose()
	@ApiProperty({
		type: Boolean,
		description: 'The owner changed the same fields since the proposal: a choice is needed',
	})
	conflict!: boolean;

	@Expose()
	@ApiProperty({ type: Boolean, description: 'The original card was deleted since (skipped)' })
	targetMissing!: boolean;
}

export class RemovedCardChangeDto {
	@Expose()
	@ApiProperty()
	targetCardId!: string;

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiProperty({ type: () => FlashCardContentDto })
	base!: FlashCardContentDto;

	@Expose()
	@Type(() => FlashCardContentDto)
	@ApiPropertyOptional({ type: () => FlashCardContentDto })
	current?: FlashCardContentDto;

	@Expose()
	@ApiProperty({ type: Boolean, description: 'The card was edited since the proposal' })
	conflict!: boolean;

	@Expose()
	@ApiProperty({ type: Boolean, description: 'Already deleted (nothing to do)' })
	targetMissing!: boolean;
}

export class FlashCardListChangesDto {
	@Expose()
	@Type(() => AddedCardChangeDto)
	@ApiProperty({ type: () => [AddedCardChangeDto] })
	added!: AddedCardChangeDto[];

	@Expose()
	@Type(() => ModifiedCardChangeDto)
	@ApiProperty({ type: () => [ModifiedCardChangeDto] })
	modified!: ModifiedCardChangeDto[];

	@Expose()
	@Type(() => RemovedCardChangeDto)
	@ApiProperty({ type: () => [RemovedCardChangeDto] })
	removed!: RemovedCardChangeDto[];
}

export class FlashCardListDiffDto {
	@Expose()
	@ApiProperty({ description: 'Your copy' })
	sourceListId!: string;

	@Expose()
	@ApiProperty({ description: 'The original list' })
	targetListId!: string;

	@Expose()
	@ApiProperty()
	targetListName!: string;

	@Expose()
	@ApiProperty()
	targetOwnerId!: string;

	@Expose()
	@Type(() => FlashCardListChangesDto)
	@ApiProperty({ type: () => FlashCardListChangesDto })
	changes!: FlashCardListChangesDto;

	@Expose()
	@ApiPropertyOptional({ description: 'Your open proposal from this copy, if any' })
	openProposalId?: string;
}

export class PullFlashCardListUpstreamDto {
	@Expose()
	@ApiProperty({ type: Number, description: 'Cards updated from the original' })
	updated!: number;

	@Expose()
	@ApiProperty({ type: Number, description: 'New cards of the original copied in' })
	added!: number;

	@Expose()
	@ApiProperty({ type: Number, description: 'Unchanged copies of cards the original deleted' })
	removed!: number;

	@Expose()
	@ApiProperty({
		type: Number,
		description: 'Cards changed in both lists: kept as they are in your copy',
	})
	skipped!: number;
}

export class FlashCardProposalDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional({ description: 'The copy the changes come from (absent once deleted)' })
	sourceListId?: string;

	@Expose()
	@ApiPropertyOptional()
	sourceListName?: string;

	@Expose()
	@ApiProperty()
	targetListId!: string;

	@Expose()
	@ApiProperty()
	targetListName!: string;

	@Expose()
	@ApiProperty()
	targetOwnerId!: string;

	@Expose()
	@ApiProperty({ description: 'The proposer' })
	authorId!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty()
	message!: string;

	@Expose()
	@ApiProperty({ enum: FlashCardProposalStatus })
	status!: FlashCardProposalStatus;

	@Expose()
	@ApiProperty({ type: Number })
	addedCount!: number;

	@Expose()
	@ApiProperty({ type: Number })
	modifiedCount!: number;

	@Expose()
	@ApiProperty({ type: Number })
	removedCount!: number;

	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	decidedAt?: string;

	@Expose()
	@ApiPropertyOptional()
	decidedBy?: string;

	@Expose()
	@ApiPropertyOptional()
	decisionNote?: string;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: string;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: string;
}

export class FlashCardProposalDetailDto extends FlashCardProposalDto {
	@Expose()
	@Type(() => FlashCardListChangesDto)
	@ApiProperty({ type: () => FlashCardListChangesDto })
	changes!: FlashCardListChangesDto;

	@Expose()
	@ApiProperty({ type: Number, description: 'Cards that need a choice before accepting' })
	conflictCount!: number;

	@Expose()
	@ApiProperty({ type: Boolean, description: 'You may accept or reject it (list owner or admin)' })
	canDecide!: boolean;

	@Expose()
	@ApiProperty({ type: Boolean, description: 'You may withdraw it (its proposer)' })
	canWithdraw!: boolean;
}

export class ListFlashCardProposalsDto {
	@Expose()
	@Type(() => FlashCardProposalDto)
	@ApiProperty({ type: () => [FlashCardProposalDto] })
	proposals!: FlashCardProposalDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;
}
