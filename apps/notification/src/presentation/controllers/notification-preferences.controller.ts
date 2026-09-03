import { NotificationPreferencesService } from '../../app/services/notification-preferences.service';
import { GetPreferencesReqDto } from '../dtos/req/get-preferences.req.dto';
import { UpdatePreferencesReqDto } from '../dtos/req/update-preferences.req.dto';
import { NotificationPreferencesDto } from '../dtos/res/notification-preferences.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
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

	@SerializeOptions({ type: NotificationPreferencesDto, strategy: 'exposeAll' })
	async getPreferences(@Payload() data: GetPreferencesReqDto): Promise<NotificationPreferencesDto> {
		return this.notificationPreferencesService.getPreferences(data.identityId);
	}

	@SerializeOptions({ type: NotificationPreferencesDto, strategy: 'exposeAll' })
	async updatePreferences(
		@Payload() data: UpdatePreferencesReqDto,
	): Promise<NotificationPreferencesDto> {
		return this.notificationPreferencesService.updatePreferences(data);
	}
}
