import { resource } from '@server/generated';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number | undefined;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number | undefined;
}
