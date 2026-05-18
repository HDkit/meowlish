import { NotificationService } from '../../services/notification.service';
import {
	RabbitPayload,
	RabbitSubscribe,
	defaultNackErrorHandler,
} from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { IsString } from 'class-validator';

class ReportStatusChangedEvent {
	@IsString() reportId!: string;
	@IsString() reportedBy!: string;
	@IsString() status!: string;
	@IsString() title!: string;
}

@Injectable()
export class ReportStatusChangedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly logger: AppLoggerService,
	) {}

	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.report.status-changed',
		queue: 'notification.events.report.status-changed',
		queueOptions: {
			durable: true,
			deadLetterExchange: 'notification.dlx',
			deadLetterRoutingKey: 'report.status-changed.failed',
		},
		errorHandler: defaultNackErrorHandler,
	})
	async handle(@RabbitPayload() payload: ReportStatusChangedEvent) {
		try {
			await this.notificationService.createNotification({
				recipientId: payload.reportedBy,
				type: 'report',
				title: 'Report Status Updated',
				message: `Your report "${payload.title}" has been ${payload.status}.`,
				data: JSON.stringify({
					reportId: payload.reportId,
					status: payload.status,
				}),
			});
		} catch (e) {
			this.logger.error(e as string);
		}
	}
}
