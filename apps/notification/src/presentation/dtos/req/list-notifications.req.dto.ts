import { notification } from '@server/generated';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListNotificationsReqDto implements notification.ListNotificationsRequest {
	@IsString()
	recipientId!: string;

	@IsOptional()
	@IsString()
	type?: string;

	@IsBoolean()
	@IsOptional()
	isRead?: boolean;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	limit?: number;
}
