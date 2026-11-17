import { RequesterReqDto } from './requester.req.dto';
import { resource } from '@server/generated';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddCardToListReqDto extends RequesterReqDto implements resource.AddCardToListRequest {
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
