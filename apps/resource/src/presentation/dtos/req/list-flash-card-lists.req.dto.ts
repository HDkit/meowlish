import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListFlashCardListsReqDto implements resource.ListFlashCardListsRequest {
	@IsOptional()
	@IsString()
	authorId?: string | undefined;

	@IsBoolean()
	@IsOptional()
	isPublic?: boolean | undefined;

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
