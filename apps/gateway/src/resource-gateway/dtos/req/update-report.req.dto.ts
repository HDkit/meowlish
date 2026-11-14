import { ReportStatus } from '../../../enums/report-status.enum';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateReportDto implements Omit<resource.UpdateReportRequest, 'id' | 'resolvedBy'> {
	@IsEnum(ReportStatus)
	@IsOptional()
	@ApiPropertyOptional({ enum: ReportStatus })
	status?: ReportStatus;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	adminResponse?: string;
}
