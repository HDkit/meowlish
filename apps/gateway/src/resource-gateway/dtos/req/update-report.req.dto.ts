import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReportDto implements Omit<resource.UpdateReportRequest, 'id' | 'resolvedBy'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	status?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	adminResponse?: string;
}
