import { resource } from '@server/generated';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCardsInListReqDto implements resource.ListCardsInListRequest {
	@IsString()
	listId!: string | undefined;

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
