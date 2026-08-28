import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListReportsReqDto implements resource.ListReportsRequest {
	@IsOptional()
	@IsString()
	reportedBy?: string;

	@IsOptional()
	@IsString()
	type?: string;

	@IsOptional()
	@IsString()
	status?: string;

	@IsOptional()
	@IsString()
	targetType?: string;

	@IsOptional()
	@IsString()
	targetId?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	limit?: number;
}
