import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListFlashCardsReqDto implements resource.ListFlashCardsRequest {
	@IsOptional()
	@IsString()
	authorId?: string;

	@IsArray()
	@IsString({ each: true })
	tags!: string[];

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
