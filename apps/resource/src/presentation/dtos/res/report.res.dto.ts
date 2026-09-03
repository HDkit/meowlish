import { resource } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class ReportDto implements resource.ReportResponse {
	@Expose()
	id!: string;

	@Expose()
	reportedBy!: string;

	@Expose()
	type!: string;

	@Expose()
	status!: string;

	@Expose()
	title!: string;

	@Expose()
	description!: string;

	@Expose()
	targetType?: string;

	@Expose()
	targetId?: string;

	@Expose()
	resolvedBy?: string;

	@Expose()
	adminResponse?: string;

	@Expose()
	fileIds!: string[];

	@Expose()
	createdAt!: string;

	@Expose()
	updatedAt!: string;
}

export class ListReportsDto implements resource.ListReportsResponse {
	@Expose()
	@Type(() => ReportDto)
	reports!: ReportDto[];

	@Expose()
	totalCount!: number;
}
