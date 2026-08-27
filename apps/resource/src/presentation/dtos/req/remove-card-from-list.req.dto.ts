import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveCardFromListReqDto implements resource.RemoveCardFromListRequest {
	@IsString()
	listId!: string | undefined;

	@IsString()
	flashCardId!: string | undefined;
}
