import { resource } from '@server/generated';
import { IsString } from 'class-validator';

export class GetFlashCardReqDto implements resource.GetFlashCardRequest {
	@IsString()
	id!: string | undefined;
}
