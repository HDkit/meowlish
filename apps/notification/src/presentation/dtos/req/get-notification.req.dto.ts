import { notification } from '@server/generated';
import { IsString } from 'class-validator';

export class GetNotificationReqDto implements notification.GetNotificationRequest {
	@IsString()
	id!: string | undefined;
}
