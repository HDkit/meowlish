import { NotificationSseController } from '../../../presentation/controllers/notification-sse.controller';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GlobalClassSerializerInterceptor } from '@server/utils';
import { type AddressInfo } from 'node:net';
import { EMPTY, of } from 'rxjs';

const setup = () => {
	const sse = { subscribe: jest.fn().mockReturnValue(EMPTY) };
	const notifications = { listMissed: jest.fn().mockResolvedValue([]) };
	return {
		sse: sse,
		notifications: notifications,
		controller: new NotificationSseController(sse as never, notifications as never),
	};
};

describe('NotificationSseController', () => {
	it('replays from Last-Event-ID for the stream’s recipient', async () => {
		const { sse, notifications, controller } = setup();
		controller.stream('u1', ' n7 ');
		const [recipientId, replay] = sse.subscribe.mock.calls[0] as [string, () => Promise<unknown>];
		expect(recipientId).toBe('u1');
		await replay();
		expect(notifications.listMissed).toHaveBeenCalledWith('u1', 'n7');
	});

	it('does not replay on a first connection', () => {
		const { sse, controller } = setup();
		controller.stream('u1', undefined);
		controller.stream('u1', '  ');
		expect(sse.subscribe.mock.calls).toEqual([
			['u1', undefined],
			['u1', undefined],
		]);
	});
});

describe('NotificationSseController over HTTP', () => {
	it('sends events whole through the global serializer', async () => {
		const notification = {
			id: 'n1',
			recipientId: 'u1',
			title: 'Xin chào',
			createdAt: '2026-11-17',
		};
		const sse = {
			subscribe: jest
				.fn()
				.mockReturnValue(
					of({ comment: 'ping' }, { id: 'n1', type: 'notification', data: notification }),
				),
		};
		const moduleRef = await Test.createTestingModule({
			controllers: [NotificationSseController],
		})
			.useMocker(() => ({}))
			.compile();
		const app = moduleRef.createNestApplication();
		app.useGlobalInterceptors(new GlobalClassSerializerInterceptor(app.get(Reflector)));
		await app.init();
		Object.assign(app.get(NotificationSseController), { sseService: sse });
		await app.listen(0);
		try {
			const { port } = (app.getHttpServer() as { address(): AddressInfo }).address();
			// The observable completes, so the response ends and the whole body can be read.
			const body = await (await fetch(`http://127.0.0.1:${port}/notifications/stream/u1`)).text();
			expect(body).toContain(': ping');
			expect(body).toContain('event: notification');
			expect(body).toContain('id: n1');
			expect(body).toContain(`data: ${JSON.stringify(notification)}`);
		} finally {
			await app.close();
		}
	});
});
