import { NotificationSseService } from './notification-sse.service';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Notification, Prisma, PrismaClient } from '@prisma-client/notification';
import { notification } from '@server/generated';

@Injectable()
export class NotificationService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly sseService: NotificationSseService,
	) {}

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
		const entity = await this.txHost.tx.notification.create({
			data: {
				recipientId: data.recipientId as string,
				type: data.type as string,
				title: data.title as string,
				message: data.message as string,
				data: data.data ? (JSON.parse(data.data) as Prisma.InputJsonValue) : undefined,
			},
		});
		const response = this.mapToResponse(entity);
		this.sseService.emit(response.recipientId, response);
		return response;
	}

	async getNotification(id: string): Promise<notification.NotificationResponse> {
		const entity = await this.txHost.tx.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		return this.mapToResponse(entity);
	}

	async deleteNotification(id: string): Promise<void> {
		const entity = await this.txHost.tx.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		await this.txHost.tx.notification.delete({ where: { id: id } });
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
			this.txHost.tx.notification.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.notification.count({ where: where }),
			this.txHost.tx.notification.count({
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
		const entity = await this.txHost.tx.notification.findUnique({ where: { id: id } });
		if (!entity) {
			throw new NotFoundException('Notification not found');
		}
		const updated = await this.txHost.tx.notification.update({
			where: { id: id },
			data: { isRead: true, readAt: new Date() },
		});
		return this.mapToResponse(updated);
	}

	async markAllAsRead(recipientId: string): Promise<void> {
		await this.txHost.tx.notification.updateMany({
			where: { recipientId: recipientId, isRead: false },
			data: { isRead: true, readAt: new Date() },
		});
	}
}
