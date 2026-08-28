import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class MinimalExamInfoDto {
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
	@ApiProperty()
	name!: string;

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;
}

export class ExamsInfoDto {
	@Expose()
	@Type(() => MinimalExamInfoDto)
	@ApiProperty({ type: () => [MinimalExamInfoDto] })
	exams!: MinimalExamInfoDto[];

	@Expose()
	@ApiProperty()
	nextCursor!: string;

	@Expose()
	@ApiProperty()
	prevCursor!: string;
}
