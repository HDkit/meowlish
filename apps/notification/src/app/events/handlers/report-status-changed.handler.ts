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

export const REPORT_STATUS_CHANGED_QUEUE = defineConsumerQueue(
	'notification.events.report.status-changed',
);

class ReportStatusChangedEvent {
	@IsString() reportId!: string;
	@IsString() reportedBy!: string;
	@IsString() status!: string;
	@IsString() title!: string;
}

const REPORT_STATUS_TEXT: Record<string, string> = {
	pending: 'đang chờ xử lý',
	reviewing: 'đang được xem xét',
	in_progress: 'đang được xử lý',
	resolved: 'đã được giải quyết',
	rejected: 'đã bị từ chối',
	dismissed: 'đã được đóng',
	closed: 'đã được đóng',
};

/** Vietnamese phrase for a report status ("đã được giải quyết"), falling back to the raw status. */
export const reportStatusText = (status: string): string =>
	REPORT_STATUS_TEXT[status.toLowerCase()] ?? `chuyển sang trạng thái "${status}"`;

@Injectable()
export class ReportStatusChangedHandler {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly preferencesService: NotificationPreferencesService,
		private readonly inbox: InboxService,
	) {}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.report.status-changed',
		...REPORT_STATUS_CHANGED_QUEUE.subscribe,
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
		if (!(await this.inbox.claim(id, REPORT_STATUS_CHANGED_QUEUE.name))) return created;
		const event = await validatePayload(ReportStatusChangedEvent, payload);
		if (!(await this.preferencesService.isEnabled(event.reportedBy, 'report'))) return created;
		created.push(
			await this.notificationService.createNotification({
				recipientId: event.reportedBy,
				type: 'report',
				title: 'Báo cáo của bạn đã được cập nhật',
				message: `Báo cáo "${event.title}" ${reportStatusText(event.status)}.`,
				data: JSON.stringify({
					reportId: event.reportId,
					status: event.status,
				}),
			}),
		);
		return created;
	}
}
