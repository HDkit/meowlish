import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ExamDetailDto {
	@Expose()
	@ApiProperty({ type: Number })
	attemptsCount!: number;

	@Expose()
	@ApiPropertyOptional()
	description?: string;

	@Expose()
	@ApiProperty({ type: Number })
	duration!: number;

	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional({ description: 'Readable URL key; lookups accept it in place of the id' })
	slug?: string;

	@Expose()
	@ApiProperty()
	name!: string;

	@Expose()
	@Type(() => SectionDto)
	@ApiProperty({ type: () => [SectionDto] })
	sections!: SectionDto[];

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;
}

class SectionDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiPropertyOptional()
	name?: string;

	@Expose()
	@ApiProperty({ type: Number })
	questionsCount!: number;

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];
}
