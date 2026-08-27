import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListBlogsReqDto implements resource.ListBlogsRequest {
	@IsOptional()
	@IsString()
	authorId?: string | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

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
