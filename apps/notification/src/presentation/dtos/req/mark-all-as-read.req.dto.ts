import { notification } from '@server/generated';
import { IsString } from 'class-validator';

export class MarkAllAsReadReqDto implements notification.MarkAllAsReadRequest {
	@IsString()
	recipientId!: string | undefined;
}
