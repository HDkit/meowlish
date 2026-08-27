import { NotificationSseService } from '../../app/services/notification-sse.service';
import { Controller, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';

interface MessageEvent {
	data: string | object;
	id?: string;
	type?: string;
	retry?: number;
}

@Controller('notifications')
export class NotificationSseController {
	constructor(private readonly sseService: NotificationSseService) {}

	@Sse('stream/:recipientId')
	stream(@Param('recipientId') recipientId: string): Observable<MessageEvent> {
		return this.sseService.subscribe(recipientId);
	}
}
