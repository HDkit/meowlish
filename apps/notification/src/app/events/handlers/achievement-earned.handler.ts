import { type NotificationReadModel } from '../../../domain/read-models/notification.read-model';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { NotificationService } from '../../services/notification.service';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { validatePayload } from '@server/utils';
import { IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';

export const ACHIEVEMENT_EARNED_QUEUE = defineConsumerQueue('notification.events.badge.earned');

class AchievementEarnedEvent {
	@IsString() uid!: string;
	@IsString() badgeName!: string;
}

@Injectable()
export class AchievementEarnedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly preferencesService: NotificationPreferencesService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'achievement.badge.earned',
		...ACHIEVEMENT_EARNED_QUEUE.subscribe,
	})
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		// pushed over SSE only after the commit: a rolled-back delivery must push nothing
		this.notificationService.push(await this.store(message));
	}

	/** Claims the event and stores its notifications, in one transaction. */
	@Transactional()
	private async store(message: unknown): Promise<NotificationReadModel[]> {
		const created: NotificationReadModel[] = [];
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, ACHIEVEMENT_EARNED_QUEUE.name))) return created;
		const event = await validatePayload(AchievementEarnedEvent, payload);
		if (!(await this.preferencesService.isEnabled(event.uid, 'achievement'))) return created;
		created.push(
			await this.notificationService.createNotification({
				recipientId: event.uid,
				type: 'achievement',
				title: 'Đạt thành tích mới!',
				message: `Bạn vừa nhận huy hiệu "${event.badgeName}". Tiếp tục phát huy nhé!`,
				data: JSON.stringify({ badgeName: event.badgeName }),
			}),
		);
		return created;
	}
}
