import {
	type NotificationListReadModel,
	type NotificationReadModel,
} from '../../domain/read-models/notification.read-model';
import {
	type CreateNotificationInput,
	type ListNotificationsInput,
} from '../types/notification.input';
import { NotificationSseService, SSE_REPLAY_LIMIT } from './notification-sse.service';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, Prisma, PrismaClient } from '@prisma-client/notification';

@Injectable()
export class NotificationService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly sseService: NotificationSseService,
	) {}

	private toReadModel(entity: Notification): NotificationReadModel {
		return {
			id: entity.id,
			recipientId: entity.recipientId,
			type: entity.type,
			title: entity.title,
			message: entity.message,
			data: entity.data ? JSON.stringify(entity.data) : undefined,
			isRead: entity.isRead,
			readAt: entity.readAt?.toISOString(),
			createdAt: entity.createdAt.toISOString(),
		};
	}

	private parseData(data?: string): Prisma.InputJsonValue | undefined {
		if (!data) return undefined;
		try {
			return JSON.parse(data) as Prisma.InputJsonValue;
		} catch {
			throw new BadRequestException('data must be a JSON string');
		}
	}

	/** Finds a notification that belongs to the recipient; other users' notifications are 404. */
	private async findOwned(id: string, recipientId: string): Promise<Notification> {
		const entity = await this.txHost.tx.notification.findFirst({
			where: { id: id, recipientId: recipientId },
		});
		if (!entity) throw new NotFoundException('Notification not found');
		return entity;
	}

	/**
	 * Stores a notification. It is not pushed over SSE: the caller calls `push` once the surrounding
	 * transaction has committed, so a rolled-back (and later redelivered) event pushes nothing.
	 */
	async createNotification(data: CreateNotificationInput): Promise<NotificationReadModel> {
		const entity = await this.txHost.tx.notification.create({
			data: {
				recipientId: data.recipientId,
				type: data.type,
				title: data.title,
				message: data.message,
				data: this.parseData(data.data),
			},
		});
		return this.toReadModel(entity);
	}

	/** Pushes stored notifications to their recipients' SSE streams; call it after the commit. */
	push(notifications: NotificationReadModel[]): void {
		for (const notification of notifications) {
			this.sseService.emit(notification.recipientId, notification);
		}
	}

	/**
	 * The recipient's notifications stored after `lastId` (an SSE `Last-Event-ID`), oldest first:
	 * the newest `SSE_REPLAY_LIMIT` of them, as older ones are still in the list. An id that is not
	 * one of the recipient's notifications (deleted, or someone else's) replays nothing.
	 */
	async listMissed(recipientId: string, lastId: string): Promise<NotificationReadModel[]> {
		const anchor = await this.txHost.tx.notification.findFirst({
			where: { id: lastId, recipientId: recipientId },
			select: { id: true, createdAt: true },
		});
		if (!anchor) return [];
		const newestFirst = await this.txHost.tx.notification.findMany({
			where: {
				recipientId: recipientId,
				OR: [
					{ createdAt: { gt: anchor.createdAt } },
					{ createdAt: anchor.createdAt, id: { gt: anchor.id } },
				],
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			take: SSE_REPLAY_LIMIT,
		});
		return newestFirst.reverse().map(n => this.toReadModel(n));
	}

	async getNotification(id: string, recipientId: string): Promise<NotificationReadModel> {
		return this.toReadModel(await this.findOwned(id, recipientId));
	}

	async deleteNotification(id: string, recipientId: string): Promise<void> {
		await this.findOwned(id, recipientId);
		await this.txHost.tx.notification.delete({ where: { id: id } });
	}

	/**
	 * Deletes a user's `flashcard` notifications about one proposal (matched on `data.proposalId`).
	 * Returns how many were deleted.
	 */
	async deleteProposalNotifications(recipientId: string, proposalId: string): Promise<number> {
		const { count } = await this.txHost.tx.notification.deleteMany({
			where: {
				recipientId: recipientId,
				type: 'flashcard',
				data: { path: ['proposalId'], equals: proposalId },
			},
		});
		return count;
	}

	async listNotifications(data: ListNotificationsInput): Promise<NotificationListReadModel> {
		const take = data.limit && data.limit > 0 ? data.limit : 10;
		const skip = ((data.page && data.page > 0 ? data.page : 1) - 1) * take;

		const where: Prisma.NotificationWhereInput = {
			recipientId: data.recipientId,
			type: data.type,
			isRead: data.isRead,
		};

		const [notifications, totalCount, unreadCount] = await Promise.all([
			this.txHost.tx.notification.findMany({
				where: where,
				skip: skip,
				take: take,
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.notification.count({ where: where }),
			this.txHost.tx.notification.count({
				where: { recipientId: data.recipientId, isRead: false },
			}),
		]);

		return {
			notifications: notifications.map(n => this.toReadModel(n)),
			totalCount: totalCount,
			unreadCount: unreadCount,
		};
	}

	async markAsRead(id: string, recipientId: string): Promise<NotificationReadModel> {
		const entity = await this.findOwned(id, recipientId);
		if (entity.isRead) return this.toReadModel(entity);

		const updated = await this.txHost.tx.notification.update({
			where: { id: id },
			data: { isRead: true, readAt: new Date() },
		});
		return this.toReadModel(updated);
	}

	async markAllAsRead(recipientId: string): Promise<void> {
		await this.txHost.tx.notification.updateMany({
			where: { recipientId: recipientId, isRead: false },
			data: { isRead: true, readAt: new Date() },
		});
	}
}
