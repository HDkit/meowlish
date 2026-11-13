import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListBlogCommentsReqDto implements resource.ListBlogCommentsRequest {
	@IsString()
	blogId!: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(50)
	@Min(1)
	limit?: number;
}
