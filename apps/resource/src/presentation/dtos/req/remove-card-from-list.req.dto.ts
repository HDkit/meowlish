import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveCardFromListReqDto implements resource.RemoveCardFromListRequest {
	@IsString()
	listId!: string;

	@IsString()
	flashCardId!: string;
}
