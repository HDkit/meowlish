export interface CreateNotificationInput {
	recipientId: string;
	type: string;
	title: string;
	message: string;
	/** JSON-encoded payload. */
	data?: string;
}

export interface ListNotificationsInput {
	recipientId: string;
	type?: string;
	isRead?: boolean;
	page?: number;
	limit?: number;
}

export interface UpdatePreferencesInput {
	identityId: string;
	emailEnabled?: boolean;
	pushEnabled?: boolean;
	achievementEnabled?: boolean;
	reportEnabled?: boolean;
	systemEnabled?: boolean;
	blogCommentEnabled?: boolean;
	commentReplyEnabled?: boolean;
	forumReplyEnabled?: boolean;
}

/** Notification types a user can opt out of via preferences. */
export type OptionalNotificationType =
	'achievement' | 'report' | 'system' | 'blogComment' | 'commentReply' | 'forumReply';
