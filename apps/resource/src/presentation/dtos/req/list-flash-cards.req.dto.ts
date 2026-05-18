import { resource } from '@server/generated';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListFlashCardsReqDto implements resource.ListFlashCardsRequest {
	@IsOptional()
	@IsString()
	authorId?: string | undefined;

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
