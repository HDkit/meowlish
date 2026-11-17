import { notification } from '@server/generated';
import { IsJSON, IsOptional, IsString } from 'class-validator';

export class CreateNotificationReqDto implements notification.CreateNotificationRequest {
	@IsString()
	recipientId!: string;

	@IsString()
	type!: string;

	@IsString()
	title!: string;

	@IsString()
	message!: string;

	@IsJSON()
	@IsOptional()
	data?: string;
}
