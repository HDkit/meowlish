import { NotificationService } from '../../app/services/notification.service';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { notification } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';
import { CreateNotificationReqDto } from '../dtos/req/create-notification.req.dto';
import { GetNotificationReqDto } from '../dtos/req/get-notification.req.dto';
import { DeleteNotificationReqDto } from '../dtos/req/delete-notification.req.dto';
import { ListNotificationsReqDto } from '../dtos/req/list-notifications.req.dto';
import { MarkAsReadReqDto } from '../dtos/req/mark-as-read.req.dto';
import { MarkAllAsReadReqDto } from '../dtos/req/mark-all-as-read.req.dto';

@UseFilters(GlobalRpcExceptionFilter)
@notification.NotificationServiceControllerMethods()
@Controller()
export class NotificationController implements notification.NotificationServiceController {
	constructor(private readonly notificationService: NotificationService) {}

	async createNotification(@Payload() data: CreateNotificationReqDto): Promise<notification.NotificationResponse> {
		return this.notificationService.createNotification(data);
	}

	async getNotification(@Payload() data: GetNotificationReqDto): Promise<notification.NotificationResponse> {
		return this.notificationService.getNotification(data.id as string);
	}

	async deleteNotification(@Payload() data: DeleteNotificationReqDto): Promise<void> {
		await this.notificationService.deleteNotification(data.id as string);
	}

	async listNotifications(@Payload() data: ListNotificationsReqDto): Promise<notification.ListNotificationsResponse> {
		return this.notificationService.listNotifications(data);
	}

	async markAsRead(@Payload() data: MarkAsReadReqDto): Promise<notification.NotificationResponse> {
		return this.notificationService.markAsRead(data.id as string);
	}

	async markAllAsRead(@Payload() data: MarkAllAsReadReqDto): Promise<void> {
		await this.notificationService.markAllAsRead(data.recipientId as string);
	}
}
