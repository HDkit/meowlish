import { resource } from '@server/generated';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddCardToListReqDto implements resource.AddCardToListRequest {
	@IsString()
	listId!: string | undefined;

	@IsString()
	flashCardId!: string | undefined;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	position?: number | undefined;
}
