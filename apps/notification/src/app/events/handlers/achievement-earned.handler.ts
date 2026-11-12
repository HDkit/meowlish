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
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, ACHIEVEMENT_EARNED_QUEUE.name))) return;
		const event = await validatePayload(AchievementEarnedEvent, payload);
		if (!(await this.preferencesService.isEnabled(event.uid, 'achievement'))) return;
		await this.notificationService.createNotification({
			recipientId: event.uid,
			type: 'achievement',
			title: 'Achievement Unlocked!',
			message: `You earned the "${event.badgeName}" badge!`,
			data: JSON.stringify({ badgeName: event.badgeName }),
		});
	}
}
