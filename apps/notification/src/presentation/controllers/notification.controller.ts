import { NotificationService } from '../../app/services/notification.service';
import { Controller } from '@nestjs/common';
import { notification } from '@server/generated';

@notification.NotificationServiceControllerMethods()
@Controller()
export class NotificationController implements notification.NotificationServiceController {
	constructor(private readonly notificationService: NotificationService) {}

	async createNotification(
		data: notification.CreateNotificationRequest,
	): Promise<notification.NotificationResponse> {
		return this.notificationService.createNotification(data);
	}

	async getNotification(
		data: notification.GetNotificationRequest,
	): Promise<notification.NotificationResponse> {
		return this.notificationService.getNotification(data.id as string);
	}

	async deleteNotification(data: notification.DeleteNotificationRequest): Promise<void> {
		await this.notificationService.deleteNotification(data.id as string);
	}

	async listNotifications(
		data: notification.ListNotificationsRequest,
	): Promise<notification.ListNotificationsResponse> {
		return this.notificationService.listNotifications(data);
	}

	async markAsRead(
		data: notification.MarkAsReadRequest,
	): Promise<notification.NotificationResponse> {
		return this.notificationService.markAsRead(data.id as string);
	}

	async markAllAsRead(data: notification.MarkAllAsReadRequest): Promise<void> {
		await this.notificationService.markAllAsRead(data.recipientId as string);
	}
}
