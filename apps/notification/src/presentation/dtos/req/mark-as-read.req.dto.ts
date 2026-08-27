import { notification } from '@server/generated';
import { IsString } from 'class-validator';

export class MarkAsReadReqDto implements notification.MarkAsReadRequest {
	@IsString()
	id!: string | undefined;
}
