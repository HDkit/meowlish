import { notification } from '@server/generated';
import { Expose, Type } from 'class-transformer';

export class NotificationDto implements notification.NotificationResponse {
	@Expose()
	id!: string;

	@Expose()
	recipientId!: string;

	@Expose()
	type!: string;

	@Expose()
	title!: string;

	@Expose()
	message!: string;

	@Expose()
	data?: string;

	@Expose()
	isRead!: boolean;

	@Expose()
	readAt?: string;

	@Expose()
	createdAt!: string;
}

export class ListNotificationsDto implements notification.ListNotificationsResponse {
	@Expose()
	@Type(() => NotificationDto)
	notifications!: NotificationDto[];

	@Expose()
	totalCount!: number;

	@Expose()
	unreadCount!: number;
}
