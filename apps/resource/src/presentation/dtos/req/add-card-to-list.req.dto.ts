import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCardToListReqDto implements resource.AddCardToListRequest {
	@IsString()
	listId!: string;

	@IsString()
	flashCardId!: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(0)
	position?: number;
}
