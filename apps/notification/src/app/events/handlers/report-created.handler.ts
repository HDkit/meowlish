import { AUTH_CLIENT } from '../../../constants/auth';
import { NotificationPreferencesService } from '../../services/notification-preferences.service';
import { NotificationService } from '../../services/notification.service';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { auth } from '@server/generated';
import { InboxService, defineConsumerQueue, unwrapEvent } from '@server/messaging';
import { Role } from '@server/typing';
import { validatePayload } from '@server/utils';
import { IsOptional, IsString } from 'class-validator';
import { UseCls } from 'nestjs-cls';
import { lastValueFrom } from 'rxjs';

export const REPORT_CREATED_QUEUE = defineConsumerQueue('notification.events.report.created');

class ReportCreatedEvent {
	@IsString() reportId!: string;
	@IsString() reportedBy!: string;
	@IsString() type!: string;
	@IsString() title!: string;
	@IsOptional() @IsString() targetType?: string | null;
	@IsOptional() @IsString() targetId?: string | null;
}

/** Tells every admin (except a reporting admin) that a report is waiting for review. */
@Injectable()
export class ReportCreatedHandler implements OnModuleInit {
	private authService!: auth.AuthServiceClient;

	constructor(
		@Inject(AUTH_CLIENT) private readonly authClient: ClientGrpc,
		private readonly notificationService: NotificationService,
		private readonly preferencesService: NotificationPreferencesService,
		private readonly inbox: InboxService,
	) {}

	onModuleInit() {
		this.authService = this.authClient.getService<auth.AuthServiceClient>(auth.AUTH_SERVICE_NAME);
	}

	@UseCls()
	@RabbitSubscribe({
		connection: 'sub',
		exchange: 'eventbus',
		routingKey: 'resource.report.created',
		...REPORT_CREATED_QUEUE.subscribe,
	})
	@Transactional()
	async handle(@RabbitPayload() message: unknown): Promise<void> {
		const { id, payload } = unwrapEvent<unknown>(message);
		if (!(await this.inbox.claim(id, REPORT_CREATED_QUEUE.name))) return;
		const event = await validatePayload(ReportCreatedEvent, payload);
		// An auth outage throws, so the message is retried instead of silently notifying nobody.
		const { ids } = await lastValueFrom(
			this.authService.findIdentityIdsByRole({ role: Role.Admin }),
		);
		for (const adminId of ids) {
			if (adminId === event.reportedBy) continue;
			if (!(await this.preferencesService.isEnabled(adminId, 'report'))) continue;
			await this.notificationService.createNotification({
				recipientId: adminId,
				type: 'report',
				title: 'Có báo cáo mới cần xử lý',
				message: `Báo cáo "${event.title}" vừa được gửi và đang chờ xem xét.`,
				data: JSON.stringify({
					reportId: event.reportId,
					targetType: event.targetType ?? null,
					targetId: event.targetId ?? null,
					action: '/report-management',
				}),
			});
		}
	}
}
