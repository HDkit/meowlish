import { resource } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReportReqDto implements resource.UpdateReportRequest {
	@IsString()
	id!: string | undefined;

	@IsOptional()
	@IsString()
	status?: string | undefined;

	@IsOptional()
	@IsString()
	resolvedBy?: string | undefined;

	@IsOptional()
	@IsString()
	adminResponse?: string | undefined;
}
