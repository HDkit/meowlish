export interface NotificationPreferencesReadModel {
	id: string;
	identityId: string;
	emailEnabled: boolean;
	pushEnabled: boolean;
	achievementEnabled: boolean;
	reportEnabled: boolean;
	systemEnabled: boolean;
	updatedAt: string;
}
