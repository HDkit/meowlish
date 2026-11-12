import { ApiPropertyOptional } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReportDto implements Omit<resource.UpdateReportRequest, 'id'> {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	status?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	resolvedBy?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	adminResponse?: string;
}
