import { notification } from '@server/generated';
import { Expose } from 'class-transformer';

export class NotificationPreferencesDto implements notification.NotificationPreferencesResponse {
	@Expose()
	id!: string;

	@Expose()
	identityId!: string;

	@Expose()
	emailEnabled!: boolean;

	@Expose()
	pushEnabled!: boolean;

	@Expose()
	achievementEnabled!: boolean;

	@Expose()
	reportEnabled!: boolean;

	@Expose()
	systemEnabled!: boolean;

	@Expose()
	updatedAt!: string;
}
