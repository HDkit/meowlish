import { NotificationService } from '../../services/notification.service';
import {
	RabbitPayload,
	RabbitSubscribe,
	defaultNackErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { IsString } from 'class-validator';

class AchievementEarnedEvent {
	@IsString() uid!: string;
	@IsString() badgeName!: string;
}

@Injectable()
export class AchievementEarnedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly logger: AppLoggerService,
	) {}

	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'achievement.badge.earned',
		queue: 'notification.events.badge.earned',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'notification.dlx',
			deadLetterRoutingKey: 'badge.earned.failed',
		},
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: AchievementEarnedEvent) {
		try {
			await this.notificationService.createNotification({
				recipientId: payload.uid,
				type: 'achievement',
				title: 'Achievement Unlocked!',
				message: `You earned the "${payload.badgeName}" badge!`,
				data: JSON.stringify({ badgeName: payload.badgeName }),
			});
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
