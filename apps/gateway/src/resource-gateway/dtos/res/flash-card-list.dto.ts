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
}

export class FlashCardListDetailDto extends FlashCardListDto {
	@Expose()
	@Type(() => FlashCardDto)
	@ApiProperty({ type: () => [FlashCardDto] })
	flashCards!: FlashCardDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCards!: number;
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
