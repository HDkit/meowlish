import { ReportStatus } from '../../../enums/report-status.enum';
import { resource } from '@server/generated';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateReportReqDto implements resource.UpdateReportRequest {
	@IsString()
	id!: string;

	@IsEnum(ReportStatus)
	@IsOptional()
	status?: ReportStatus;

	@IsOptional()
	@IsString()
	resolvedBy?: string;

	@IsOptional()
	@IsString()
	adminResponse?: string;
}
