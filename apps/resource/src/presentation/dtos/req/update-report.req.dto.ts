import { resource } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReportReqDto implements resource.UpdateReportRequest {
	@IsString()
	id!: string;

	@IsOptional()
	@IsString()
	status?: string;

	@IsOptional()
	@IsString()
	resolvedBy?: string;

	@IsOptional()
	@IsString()
	adminResponse?: string;
}
