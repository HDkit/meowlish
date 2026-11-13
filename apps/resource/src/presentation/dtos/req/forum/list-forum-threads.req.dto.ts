import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListForumThreadsReqDto implements resource.ListForumThreadsRequest {
	@IsString()
	categoryId!: string;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	search?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(100)
	@Min(1)
	limit?: number;
}
