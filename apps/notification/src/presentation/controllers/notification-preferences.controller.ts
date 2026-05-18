import { NotificationPreferencesService } from '../../app/services/notification-preferences.service';
import { Controller } from '@nestjs/common';
import { notification } from '@server/generated';

@notification.NotificationPreferencesServiceControllerMethods()
@Controller()
export class NotificationPreferencesController
	implements notification.NotificationPreferencesServiceController
{
	constructor(private readonly notificationPreferencesService: NotificationPreferencesService) {}

	async getPreferences(
		data: notification.GetPreferencesRequest,
	): Promise<notification.NotificationPreferencesResponse> {
		return this.notificationPreferencesService.getPreferences(data.identityId as string);
	}

	async updatePreferences(
		data: notification.UpdatePreferencesRequest,
	): Promise<notification.NotificationPreferencesResponse> {
		return this.notificationPreferencesService.updatePreferences(data);
	}
}
