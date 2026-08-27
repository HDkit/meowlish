import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListCardsInListReqDto implements resource.ListCardsInListRequest {
	@IsString()
	listId!: string | undefined;

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
