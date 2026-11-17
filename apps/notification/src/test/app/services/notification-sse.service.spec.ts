import {
	NotificationSseService,
	SSE_CHANNEL,
	SSE_HEARTBEAT_MS,
} from '../../../app/services/notification-sse.service';
import { type NotificationReadModel } from '../../../domain/read-models/notification.read-model';
import { type MessageEvent } from '@nestjs/common';

// One in-memory Redis shared by every "replica": a publish reaches every subscribed connection.
jest.mock('ioredis', () => {
	const subscribers = new Set<FakeRedis>();
	class FakeRedis {
		static failPublish = false;
		private handler?: (channel: string, message: string) => void;
		on(_event: 'message', handler: (channel: string, message: string) => void) {
			this.handler = handler;
			return this;
		}
		subscribe() {
			subscribers.add(this);
			return Promise.resolve(1);
		}
		publish(channel: string, message: string) {
			if (FakeRedis.failPublish) return Promise.reject(new Error('down'));
			for (const s of subscribers) s.handler?.(channel, message);
			return Promise.resolve(subscribers.size);
		}
		quit() {
			subscribers.delete(this);
			return Promise.resolve('OK');
		}
	}
	return { __esModule: true, default: FakeRedis };
});

const { default: FakeRedis } = jest.requireMock<{ default: { failPublish: boolean } }>('ioredis');

const notification = (id: string, recipientId = 'u1'): NotificationReadModel => ({
	id: id,
	recipientId: recipientId,
	type: 'achievement',
	title: 't',
	message: 'm',
	isRead: false,
	createdAt: new Date(0).toISOString(),
});

const replica = async () => {
	const config = { getOrThrow: () => ({ host: 'redis', port: 6379 }) };
	const logger = { warn: jest.fn(), error: jest.fn() };
	const service = new NotificationSseService(config as never, logger as never);
	await service.onModuleInit();
	return service;
};

const flush = () => new Promise(resolve => setImmediate(resolve));

const collect = (
	service: NotificationSseService,
	...args: Parameters<NotificationSseService['subscribe']>
) => {
	const events: MessageEvent[] = [];
	const sub = service.subscribe(...args).subscribe(e => events.push(e));
	const notifications = () => events.filter(e => e.comment === undefined);
	return { events: events, notifications: notifications, stop: () => sub.unsubscribe() };
};

describe('NotificationSseService', () => {
	const replicas: NotificationSseService[] = [];
	const start = async () => {
		const r = await replica();
		replicas.push(r);
		return r;
	};
	afterEach(async () => {
		FakeRedis.failPublish = false;
		await Promise.all(replicas.splice(0).map(r => r.onModuleDestroy()));
	});

	it('delivers a push stored on one replica to a stream on another, with the id as SSE id', async () => {
		const [a, b] = [await start(), await start()];
		const stream = collect(b, 'u1');
		const other = collect(b, 'u2');
		a.emit('u1', notification('n1'));
		await flush();
		expect(stream.notifications()).toEqual([
			{ id: 'n1', type: 'notification', data: notification('n1') },
		]);
		expect(other.notifications()).toEqual([]);
		stream.stop();
		other.stop();
	});

	it('still delivers locally when Redis publish fails', async () => {
		const a = await start();
		const stream = collect(a, 'u1');
		FakeRedis.failPublish = true;
		a.emit('u1', notification('n1'));
		await flush();
		expect(stream.notifications().map(e => e.id)).toEqual(['n1']);
		stream.stop();
	});

	it('sends a comment heartbeat at once and then every 25 s', async () => {
		jest.useFakeTimers();
		try {
			const a = await start();
			const stream = collect(a, 'u1');
			jest.advanceTimersByTime(0);
			expect(stream.events).toEqual([{ comment: 'ping' }]);
			jest.advanceTimersByTime(SSE_HEARTBEAT_MS);
			expect(stream.events).toHaveLength(2);
			stream.stop();
		} finally {
			jest.useRealTimers();
		}
	});

	it('replays missed notifications first, then held live pushes, without duplicates', async () => {
		const a = await start();
		let resolveReplay!: (list: NotificationReadModel[]) => void;
		const replay = jest.fn(
			() => new Promise<NotificationReadModel[]>(resolve => (resolveReplay = resolve)),
		);
		const stream = collect(a, 'u1', replay);
		// pushed while the replay query runs: n2 is also in the replay, n3 is not
		a.emit('u1', notification('n2'));
		a.emit('u1', notification('n3'));
		await flush();
		expect(stream.notifications()).toEqual([]);
		resolveReplay([notification('n1'), notification('n2')]);
		await flush();
		expect(stream.notifications().map(e => e.id)).toEqual(['n1', 'n2', 'n3']);
		stream.stop();
	});

	it('goes live when the replay fails', async () => {
		const a = await start();
		const stream = collect(a, 'u1', () => Promise.reject(new Error('db')));
		await flush();
		a.emit('u1', notification('n1'));
		await flush();
		expect(stream.notifications().map(e => e.id)).toEqual(['n1']);
		stream.stop();
	});

	it('ignores malformed channel messages', async () => {
		const a = await start();
		const stream = collect(a, 'u1');
		const { default: Redis } = jest.requireMock<{
			default: new () => { publish: (c: string, m: string) => Promise<number> };
		}>('ioredis');
		await new Redis().publish(SSE_CHANNEL, '{not json');
		expect(stream.notifications()).toEqual([]);
		stream.stop();
	});
});
