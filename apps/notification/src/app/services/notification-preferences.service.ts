import { Inject, Injectable } from '@nestjs/common';
import { NotificationPreference, PrismaClient } from '@prisma-client/notification';
import { DATABASE_SERVICE } from '@server/database';
import { notification } from '@server/generated';

@Injectable()
export class NotificationPreferencesService {
	constructor(@Inject(DATABASE_SERVICE) private readonly prisma: PrismaClient) {}

	private mapToResponse(
		entity: NotificationPreference,
	): notification.NotificationPreferencesResponse {
		return {
			id: entity.id,
			identityId: entity.identityId,
			emailEnabled: entity.emailEnabled,
			pushEnabled: entity.pushEnabled,
			achievementEnabled: entity.achievementEnabled,
			reportEnabled: entity.reportEnabled,
			systemEnabled: entity.systemEnabled,
			updatedAt: entity.updatedAt.toISOString(),
		};
	}

	async getPreferences(identityId: string): Promise<notification.NotificationPreferencesResponse> {
		const entity = await this.prisma.notificationPreference.upsert({
			where: { identityId: identityId },
			update: {},
			create: { identityId: identityId },
		});
		return this.mapToResponse(entity);
	}

	async updatePreferences(
		data: notification.UpdatePreferencesRequest,
	): Promise<notification.NotificationPreferencesResponse> {
		const entity = await this.prisma.notificationPreference.upsert({
			where: { identityId: data.identityId as string },
			update: {
				emailEnabled: data.emailEnabled ?? undefined,
				pushEnabled: data.pushEnabled ?? undefined,
				achievementEnabled: data.achievementEnabled ?? undefined,
				reportEnabled: data.reportEnabled ?? undefined,
				systemEnabled: data.systemEnabled ?? undefined,
			},
			create: {
				identityId: data.identityId as string,
				emailEnabled: data.emailEnabled ?? true,
				pushEnabled: data.pushEnabled ?? true,
				achievementEnabled: data.achievementEnabled ?? true,
				reportEnabled: data.reportEnabled ?? true,
				systemEnabled: data.systemEnabled ?? true,
			},
		});
		return this.mapToResponse(entity);
	}
}
