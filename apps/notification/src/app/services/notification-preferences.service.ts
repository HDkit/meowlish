import { type NotificationPreferencesReadModel } from '../../domain/read-models/notification-preferences.read-model';
import {
	type OptionalNotificationType,
	type UpdatePreferencesInput,
} from '../types/notification.input';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { NotificationPreference, PrismaClient } from '@prisma-client/notification';

@Injectable()
export class NotificationPreferencesService {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	private toReadModel(entity: NotificationPreference): NotificationPreferencesReadModel {
		return {
			id: entity.id,
			identityId: entity.identityId,
			emailEnabled: entity.emailEnabled,
			pushEnabled: entity.pushEnabled,
			achievementEnabled: entity.achievementEnabled,
			reportEnabled: entity.reportEnabled,
			systemEnabled: entity.systemEnabled,
			blogCommentEnabled: entity.blogCommentEnabled,
			commentReplyEnabled: entity.commentReplyEnabled,
			forumReplyEnabled: entity.forumReplyEnabled,
			updatedAt: entity.updatedAt.toISOString(),
		};
	}

	async getPreferences(identityId: string): Promise<NotificationPreferencesReadModel> {
		const entity = await this.txHost.tx.notificationPreference.upsert({
			where: { identityId: identityId },
			update: {},
			create: { identityId: identityId },
		});
		return this.toReadModel(entity);
	}

	async updatePreferences(data: UpdatePreferencesInput): Promise<NotificationPreferencesReadModel> {
		const entity = await this.txHost.tx.notificationPreference.upsert({
			where: { identityId: data.identityId },
			update: {
				emailEnabled: data.emailEnabled,
				pushEnabled: data.pushEnabled,
				achievementEnabled: data.achievementEnabled,
				reportEnabled: data.reportEnabled,
				systemEnabled: data.systemEnabled,
				blogCommentEnabled: data.blogCommentEnabled,
				commentReplyEnabled: data.commentReplyEnabled,
				forumReplyEnabled: data.forumReplyEnabled,
			},
			create: {
				identityId: data.identityId,
				emailEnabled: data.emailEnabled,
				pushEnabled: data.pushEnabled,
				achievementEnabled: data.achievementEnabled,
				reportEnabled: data.reportEnabled,
				systemEnabled: data.systemEnabled,
				blogCommentEnabled: data.blogCommentEnabled,
				commentReplyEnabled: data.commentReplyEnabled,
				forumReplyEnabled: data.forumReplyEnabled,
			},
		});
		return this.toReadModel(entity);
	}

	/** Whether the user wants notifications of this type. Users without saved preferences get everything. */
	async isEnabled(identityId: string, type: OptionalNotificationType): Promise<boolean> {
		const prefs = await this.txHost.tx.notificationPreference.findUnique({
			where: { identityId: identityId },
		});
		if (!prefs) return true;
		const enabledByType: Record<OptionalNotificationType, boolean> = {
			achievement: prefs.achievementEnabled,
			report: prefs.reportEnabled,
			system: prefs.systemEnabled,
			blogComment: prefs.blogCommentEnabled,
			commentReply: prefs.commentReplyEnabled,
			forumReply: prefs.forumReplyEnabled,
		};
		return enabledByType[type];
	}
}
