export interface NotificationReadModel {
	id: string;
	recipientId: string;
	type: string;
	title: string;
	message: string;
	/** JSON-encoded payload. */
	data?: string;
	isRead: boolean;
	readAt?: string;
	createdAt: string;
}

export interface NotificationListReadModel {
	notifications: NotificationReadModel[];
	totalCount: number;
	unreadCount: number;
}
