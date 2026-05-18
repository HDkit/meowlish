import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { notification } from '@server/generated';
import { Observable, Subject, filter, finalize, map } from 'rxjs';

interface NotificationEvent {
	recipientId: string;
	notification: notification.NotificationResponse;
}

interface MessageEvent {
	data: string | object;
	id?: string;
	type?: string;
	retry?: number;
}

@Injectable()
export class NotificationSseService implements OnModuleDestroy {
	private readonly events$ = new Subject<NotificationEvent>();

	constructor(private readonly eventEmitter: EventEmitter2) {
		this.eventEmitter.on('notification.created', (event: NotificationEvent) => {
			this.events$.next(event);
		});
	}

	emit(recipientId: string, notif: notification.NotificationResponse) {
		this.eventEmitter.emit('notification.created', { recipientId, notification: notif });
	}

	subscribe(recipientId: string): Observable<MessageEvent> {
		return this.events$.pipe(
			filter((event) => event.recipientId === recipientId),
			map((event) => ({
				data: event.notification,
				type: 'notification',
			})),
			finalize(() => {}),
		);
	}

	onModuleDestroy() {
		this.events$.complete();
	}
}
