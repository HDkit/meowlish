import { FlashCardDto } from './flash-card.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class FlashCardListDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiProperty()
	description!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty({ type: Boolean })
	isPublic!: boolean;

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: Date;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;

	@Expose()
	@ApiPropertyOptional({
		description: 'On a saved copy: the original list (absent once the original is deleted)',
	})
	forkedFromId?: string;

	@Expose()
	@ApiPropertyOptional({ description: 'On a saved copy: the original list name when copied' })
	forkedFromName?: string;

	@Expose()
	@ApiPropertyOptional({ description: 'On a saved copy: the author of the original list' })
	forkedFromAuthorId?: string;

	@Expose()
	@ApiProperty({ type: Number, description: 'How many copies were saved of this list' })
	forkCount!: number;
}

export class FlashCardListDetailDto extends FlashCardListDto {
	@Expose()
	@Type(() => FlashCardDto)
	@ApiProperty({ type: () => [FlashCardDto] })
	flashCards!: FlashCardDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCards!: number;

	@Expose()
	@ApiProperty({
		type: Number,
		description: 'Open change proposals on this list (counted for its owner and admins, else 0)',
	})
	openProposalCount!: number;

	@Expose()
	@ApiProperty({
		type: Boolean,
		description: 'This is a copy whose original still exists and is visible to you',
	})
	upstreamAvailable!: boolean;
}

export class ListFlashCardListsDto {
	@Expose()
	@Type(() => FlashCardListDto)
	@ApiProperty({ type: () => [FlashCardListDto] })
	lists!: FlashCardListDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;
}
