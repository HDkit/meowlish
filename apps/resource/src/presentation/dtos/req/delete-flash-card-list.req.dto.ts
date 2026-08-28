import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteFlashCardListReqDto implements resource.DeleteFlashCardListRequest {
	@IsString()
	id!: string;
}
