import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListReportsReqDto implements resource.ListReportsRequest {
	@IsOptional()
	@IsString()
	reportedBy?: string | undefined;

	@IsOptional()
	@IsString()
	type?: string | undefined;

	@IsOptional()
	@IsString()
	status?: string | undefined;

	@IsOptional()
	@IsString()
	targetType?: string | undefined;

	@IsOptional()
	@IsString()
	targetId?: string | undefined;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number | undefined;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	limit?: number | undefined;
}
