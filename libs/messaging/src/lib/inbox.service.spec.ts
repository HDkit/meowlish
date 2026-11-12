import { InboxService, type InboxTransactionHost } from './inbox.service';

type CreateManyArgs = Parameters<InboxTransactionHost['tx']['inboxEvent']['createMany']>[0];

const EVENT_ID = '6f1c2b1e-0000-4000-8000-000000000001';

describe('InboxService', () => {
	function setup(options: { active?: boolean; count?: number; error?: unknown } = {}) {
		const createMany = jest.fn<Promise<{ count: number }>, [CreateManyArgs]>();
		if (options.error !== undefined) {
			createMany.mockRejectedValue(options.error);
		} else {
			createMany.mockResolvedValue({ count: options.count ?? 1 });
		}
		const txHost: InboxTransactionHost = {
			isTransactionActive: () => options.active ?? true,
			tx: { inboxEvent: { createMany: createMany } },
		};
		const service = new InboxService(txHost, { serviceName: 'exam' });
		return { createMany: createMany, service: service };
	}

	it('claim inserts and returns true for a new event', async () => {
		const { createMany, service } = setup({ count: 1 });

		const claimed = await service.claim(EVENT_ID, 'exam.scoring');

		expect(claimed).toBe(true);
		expect(createMany).toHaveBeenCalledTimes(1);
		expect(createMany).toHaveBeenCalledWith({
			data: [{ id: EVENT_ID, consumer: 'exam.scoring' }],
			skipDuplicates: true,
		});
	});

	it('claim returns false for an already processed event', async () => {
		const { service } = setup({ count: 0 });

		const claimed = await service.claim(EVENT_ID, 'exam.scoring');

		expect(claimed).toBe(false);
	});

	it('claim propagates other errors', async () => {
		const failure = new Error('connection lost');
		const { service } = setup({ error: failure });

		await expect(service.claim(EVENT_ID, 'exam.scoring')).rejects.toBe(failure);
	});

	it('claim returns true without writing for legacy messages', async () => {
		const { createMany, service } = setup();

		const claimed = await service.claim(undefined, 'exam.scoring');

		expect(claimed).toBe(true);
		expect(createMany).not.toHaveBeenCalled();
	});

	it('claim throws outside a transaction', async () => {
		const { createMany, service } = setup({ active: false });

		await expect(service.claim(EVENT_ID, 'exam.scoring')).rejects.toThrow(
			'InboxService.claim must run inside a transaction',
		);
		expect(createMany).not.toHaveBeenCalled();
	});
});
