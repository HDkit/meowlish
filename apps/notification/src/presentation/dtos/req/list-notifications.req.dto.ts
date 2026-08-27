import { notification } from '@server/generated';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListNotificationsReqDto implements notification.ListNotificationsRequest {
	@IsString()
	recipientId!: string | undefined;

	@IsOptional()
	@IsString()
	type?: string | undefined;

	@IsBoolean()
	@IsOptional()
	isRead?: boolean | undefined;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	page?: number | undefined;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Min(1)
	limit?: number | undefined;
}
