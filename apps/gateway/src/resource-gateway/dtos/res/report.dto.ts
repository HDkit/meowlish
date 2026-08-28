import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ReportDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	reportedBy!: string;

	@Expose()
	@ApiProperty()
	type!: string;

	@Expose()
	@ApiProperty()
	status!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty()
	description!: string;

	@Expose()
	@ApiPropertyOptional()
	targetType?: string;

	@Expose()
	@ApiPropertyOptional()
	targetId?: string;

	@Expose()
	@ApiPropertyOptional()
	resolvedBy?: string;

	@Expose()
	@ApiPropertyOptional()
	adminResponse?: string;

	@Expose()
	@ApiProperty({ type: [String] })
	fileIds!: string[];

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: Date;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;
}

export class ListReportsDto {
	@Expose()
	@Type(() => ReportDto)
	@ApiProperty({ type: () => [ReportDto] })
	reports!: ReportDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;
}
