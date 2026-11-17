import { type IEnvVars } from '../../configs/config';
import { type NotificationReadModel } from '../../domain/read-models/notification.read-model';
import { Injectable, MessageEvent, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@server/logger';
import Redis from 'ioredis';
import { Observable, Subject, map, merge, timer } from 'rxjs';

interface NotificationEvent {
	recipientId: string;
	notification: NotificationReadModel;
}

/** Redis channel every replica publishes pushes to and subscribes to. */
export const SSE_CHANNEL = 'notification:sse';

/** Comment sent on open (so the headers go out at once) and then every 25 s, so proxies keep idle streams. */
export const SSE_HEARTBEAT_MS = 25_000;

/** At most this many missed notifications are replayed on reconnect (the newest ones). */
export const SSE_REPLAY_LIMIT = 100;

/**
 * Live notification streams. A push is published on Redis, and every replica (this one included)
 * forwards it to the streams of that recipient connected to it, so it does not matter which
 * replica stored the notification or which one the browser is connected to.
 */
@Injectable()
export class NotificationSseService implements OnModuleInit, OnModuleDestroy {
	private readonly events$ = new Subject<NotificationEvent>();
	private publisher?: Redis;
	private subscriber?: Redis;

	constructor(
		private readonly configService: ConfigService<IEnvVars>,
		private readonly logger: AppLoggerService,
	) {}

	async onModuleInit(): Promise<void> {
		const redis = this.configService.getOrThrow('redis', { infer: true });
		// a connection in subscriber mode cannot publish, so there are two
		this.publisher = new Redis({ host: redis.host, port: redis.port });
		this.subscriber = new Redis({ host: redis.host, port: redis.port });
		this.subscriber.on('message', (channel: string, message: string) => {
			if (channel === SSE_CHANNEL) this.deliver(message);
		});
		await this.subscriber.subscribe(SSE_CHANNEL);
	}

	async onModuleDestroy(): Promise<void> {
		this.events$.complete();
		await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
	}

	private deliver(message: string): void {
		try {
			this.events$.next(JSON.parse(message) as NotificationEvent);
		} catch {
			this.logger.warn(`Ignored a malformed message on ${SSE_CHANNEL}`, 'NotificationSseService');
		}
	}

	/** Pushes a stored notification to its recipient's streams on every replica. */
	emit(recipientId: string, notif: NotificationReadModel): void {
		const event: NotificationEvent = { recipientId: recipientId, notification: notif };
		const message = JSON.stringify(event);
		if (!this.publisher) {
			this.deliver(message);
			return;
		}
		this.publisher.publish(SSE_CHANNEL, message).catch((error: unknown) => {
			// Redis is down: at least the streams on this replica get it (the row is stored anyway).
			this.logger.error(
				`SSE publish failed, delivering locally only: ${String(error)}`,
				undefined,
				'NotificationSseService',
			);
			this.deliver(message);
		});
	}

	/**
	 * A recipient's stream: their notifications (SSE `id` = notification id), and a comment
	 * heartbeat. With `replay` (a reconnect with `Last-Event-ID`), the notifications it returns go
	 * out first; live pushes that arrive meanwhile are held back until then, and skipped if the
	 * replay already sent them.
	 */
	subscribe(
		recipientId: string,
		replay?: () => Promise<NotificationReadModel[]>,
	): Observable<MessageEvent> {
		const notifications$ = new Observable<NotificationReadModel>(subscriber => {
			let held: NotificationReadModel[] | undefined = replay ? [] : undefined;
			const live = this.events$.subscribe(event => {
				if (event.recipientId !== recipientId) return;
				if (held) held.push(event.notification);
				else subscriber.next(event.notification);
			});
			const release = (replayed: NotificationReadModel[]) => {
				const sent = new Set(replayed.map(n => n.id));
				for (const n of replayed) subscriber.next(n);
				for (const n of held ?? []) if (!sent.has(n.id)) subscriber.next(n);
				held = undefined;
			};
			replay?.().then(release, (error: unknown) => {
				this.logger.error(
					`SSE replay failed for ${recipientId}: ${String(error)}`,
					undefined,
					'NotificationSseService',
				);
				release([]);
			});
			return () => live.unsubscribe();
		});

		return merge(
			notifications$.pipe(
				map((n): MessageEvent => ({
					id: n.id,
					type: 'notification',
					data: n,
				})),
			),
			timer(0, SSE_HEARTBEAT_MS).pipe(map((): MessageEvent => ({ comment: 'ping' }))),
		);
	}
}
