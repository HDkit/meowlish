import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, Prisma, PrismaClient } from '@prisma-client/notification';
import { DATABASE_SERVICE } from '@server/database';
import { notification } from '@server/generated';

@Injectable()
export class NotificationService {
	constructor(@Inject(DATABASE_SERVICE) private readonly prisma: PrismaClient) {}

	private mapToResponse(entity: Notification): notification.NotificationResponse {
		return {
			id: entity.id,
			recipientId: entity.recipientId,
			type: entity.type,
			title: entity.title,
			message: entity.message,
			data: entity.data ? JSON.stringify(entity.data) : undefined,
			isRead: entity.isRead,
			readAt: entity.readAt?.toISOString() ?? undefined,
			createdAt: entity.createdAt.toISOString(),
		};
	}

	async createNotification(
		data: notification.CreateNotificationRequest,
	): Promise<notification.NotificationResponse> {
		const entity = await this.prisma.notification.create({
			data: {
				recipientId: data.recipientId as string,
				type: data.type as string,
				title: data.title as string,
				message: data.message as string,
				data: data.data ? (JSON.parse(data.data) as Prisma.InputJsonValue) : undefined,
			},
		});
		return this.mapToResponse(entity);
	}

	async getNotification(id: string): Promise<notification.NotificationResponse> {
		const entity = await this.prisma.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		return this.mapToResponse(entity);
	}

	async deleteNotification(id: string): Promise<void> {
		const entity = await this.prisma.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		await this.prisma.notification.delete({ where: { id: id } });
	}

	async listNotifications(
		data: notification.ListNotificationsRequest,
	): Promise<notification.ListNotificationsResponse> {
		const page = data.page || 1;
		const limit = data.limit || 10;
		const skip = (page - 1) * limit;

		const where: Record<string, unknown> = {
			recipientId: data.recipientId as string,
		};
		if (data.type) where.type = data.type;
		if (data.isRead !== undefined && data.isRead !== null) where.isRead = data.isRead;

		const [notifications, totalCount, unreadCount] = await Promise.all([
			this.prisma.notification.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.notification.count({ where: where }),
			this.prisma.notification.count({
				where: { recipientId: data.recipientId as string, isRead: false },
			}),
		]);

		return {
			notifications: notifications.map(n => this.mapToResponse(n)),
			totalCount: totalCount,
			unreadCount: unreadCount,
		};
	}

	async markAsRead(id: string): Promise<notification.NotificationResponse> {
		const entity = await this.prisma.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		const updated = await this.prisma.notification.update({
			where: { id: id },
			data: { isRead: true, readAt: new Date() },
		});
		return this.mapToResponse(updated);
	}

	async markAllAsRead(recipientId: string): Promise<void> {
		await this.prisma.notification.updateMany({
			where: { recipientId: recipientId, isRead: false },
			data: { isRead: true, readAt: new Date() },
		});
	}
}
