import { resource } from '@server/generated';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListFlashCardListsReqDto implements resource.ListFlashCardListsRequest {
	@IsOptional()
	@IsString()
	authorId?: string | undefined;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean | undefined;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

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
