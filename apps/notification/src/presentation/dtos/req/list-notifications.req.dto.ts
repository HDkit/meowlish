import { notification } from '@server/generated';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListNotificationsReqDto implements notification.ListNotificationsRequest {
	@IsString()
	recipientId!: string | undefined;

	@IsOptional()
	@IsString()
	type?: string | undefined;

	@IsOptional()
	@IsBoolean()
	isRead?: boolean | undefined;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number | undefined;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	limit?: number | undefined;
}
