import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteFlashCardReqDto implements resource.DeleteFlashCardRequest {
	@IsString()
	id!: string;
}
