import { NotificationService } from '../../app/services/notification.service';
import { CreateNotificationReqDto } from '../dtos/req/create-notification.req.dto';
import { DeleteNotificationReqDto } from '../dtos/req/delete-notification.req.dto';
import { GetNotificationReqDto } from '../dtos/req/get-notification.req.dto';
import { ListNotificationsReqDto } from '../dtos/req/list-notifications.req.dto';
import { MarkAllAsReadReqDto } from '../dtos/req/mark-all-as-read.req.dto';
import { MarkAsReadReqDto } from '../dtos/req/mark-as-read.req.dto';
import { ListNotificationsDto, NotificationDto } from '../dtos/res/notification.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { notification } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@notification.NotificationServiceControllerMethods()
@Controller()
export class NotificationController implements notification.NotificationServiceController {
	constructor(private readonly notificationService: NotificationService) {}

	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	async createNotification(@Payload() data: CreateNotificationReqDto): Promise<NotificationDto> {
		return this.notificationService.createNotification(data);
	}

	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	async getNotification(@Payload() data: GetNotificationReqDto): Promise<NotificationDto> {
		return this.notificationService.getNotification(data.id);
	}

	async deleteNotification(@Payload() data: DeleteNotificationReqDto): Promise<void> {
		await this.notificationService.deleteNotification(data.id);
	}

	@SerializeOptions({ type: ListNotificationsDto, strategy: 'exposeAll' })
	async listNotifications(@Payload() data: ListNotificationsReqDto): Promise<ListNotificationsDto> {
		return this.notificationService.listNotifications(data);
	}

	@SerializeOptions({ type: NotificationDto, strategy: 'exposeAll' })
	async markAsRead(@Payload() data: MarkAsReadReqDto): Promise<NotificationDto> {
		return this.notificationService.markAsRead(data.id);
	}

	async markAllAsRead(@Payload() data: MarkAllAsReadReqDto): Promise<void> {
		await this.notificationService.markAllAsRead(data.recipientId);
	}
}
