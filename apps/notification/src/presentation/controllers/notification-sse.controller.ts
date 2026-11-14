import { NotificationSseService } from '../../app/services/notification-sse.service';
import { NotificationService } from '../../app/services/notification.service';
import { Controller, Headers, MessageEvent, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

@Controller('notifications')
export class NotificationSseController {
	constructor(
		private readonly sseService: NotificationSseService,
		private readonly notificationService: NotificationService,
	) {}

	/**
	 * `Last-Event-ID` (sent by EventSource on reconnect, forwarded by the gateway proxy) is the id of
	 * the last notification the client got; the ones stored after it are replayed first.
	 */
	@Sse('stream/:recipientId')
	stream(
		@Param('recipientId') recipientId: string,
		@Headers('last-event-id') lastEventId?: string,
	): Observable<MessageEvent> {
		const lastId = lastEventId?.trim();
		return this.sseService.subscribe(
			recipientId,
			lastId ? () => this.notificationService.listMissed(recipientId, lastId) : undefined,
		);
	}
}
