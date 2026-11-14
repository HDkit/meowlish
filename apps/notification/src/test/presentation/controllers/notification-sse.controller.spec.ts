import { NotificationSseController } from '../../../presentation/controllers/notification-sse.controller';
import { EMPTY } from 'rxjs';

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
