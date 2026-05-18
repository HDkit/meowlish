import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetFlashCardListReqDto implements resource.GetFlashCardListRequest {
	@IsString()
	id!: string | undefined;
}
