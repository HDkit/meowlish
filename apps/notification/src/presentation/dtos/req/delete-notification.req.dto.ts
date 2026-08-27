import { notification } from '@server/generated';
import { IsString } from 'class-validator';

export class DeleteNotificationReqDto implements notification.DeleteNotificationRequest {
	@IsString()
	id!: string | undefined;
}
