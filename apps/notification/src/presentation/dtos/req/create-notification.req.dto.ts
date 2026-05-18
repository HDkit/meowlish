import { notification } from '@server/generated';
import { IsOptional, IsString } from 'class-validator';

export class CreateNotificationReqDto implements notification.CreateNotificationRequest {
	@IsString()
	recipientId!: string | undefined;

	@IsString()
	type!: string | undefined;

	@IsString()
	title!: string | undefined;

	@IsString()
	message!: string | undefined;

	@IsOptional()
	@IsString()
	data?: string | undefined;
}
