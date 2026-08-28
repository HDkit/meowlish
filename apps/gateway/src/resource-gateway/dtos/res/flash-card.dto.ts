import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class FlashCardDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	word!: string;

	@Expose()
	@ApiProperty()
	definition!: string;

	@Expose()
	@ApiPropertyOptional()
	image?: string;

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
	@ApiProperty()
	authorId!: string;

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

export class ListFlashCardsDto {
	@Expose()
	@Type(() => FlashCardDto)
	@ApiProperty({ type: () => [FlashCardDto] })
	flashCards!: FlashCardDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;
}
