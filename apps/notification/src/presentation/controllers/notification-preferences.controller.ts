import { NotificationPreferencesService } from '../../app/services/notification-preferences.service';
import { GetPreferencesReqDto } from '../dtos/req/get-preferences.req.dto';
import { UpdatePreferencesReqDto } from '../dtos/req/update-preferences.req.dto';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { notification } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@notification.NotificationPreferencesServiceControllerMethods()
@Controller()
export class NotificationPreferencesController
	implements notification.NotificationPreferencesServiceController
{
	constructor(private readonly notificationPreferencesService: NotificationPreferencesService) {}

	async getPreferences(
		@Payload() data: GetPreferencesReqDto,
	): Promise<notification.NotificationPreferencesResponse> {
		return this.notificationPreferencesService.getPreferences(data.identityId);
	}

	async updatePreferences(
		@Payload() data: UpdatePreferencesReqDto,
	): Promise<notification.NotificationPreferencesResponse> {
		return this.notificationPreferencesService.updatePreferences(data);
	}
}
