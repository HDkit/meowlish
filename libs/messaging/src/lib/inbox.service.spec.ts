import { InboxService, type InboxTransactionHost } from './inbox.service';

type CreateArgs = Parameters<InboxTransactionHost['tx']['inboxEvent']['create']>[0];

describe('InboxService', () => {
	function setup(options: { active?: boolean; createError?: unknown } = {}) {
		const create = jest.fn<Promise<unknown>, [CreateArgs]>();
		if (options.createError !== undefined) {
			create.mockRejectedValue(options.createError);
		} else {
			create.mockResolvedValue(undefined);
		}
		const txHost: InboxTransactionHost = {
			isTransactionActive: () => options.active ?? true,
			tx: { inboxEvent: { create: create } },
		};
		const service = new InboxService(txHost, { serviceName: 'exam' });
		return { create: create, service: service };
	}

	it('claim inserts and returns true for a new event', async () => {
		const { create, service } = setup();

		const claimed = await service.claim('6f1c2b1e-0000-4000-8000-000000000001', 'exam.scoring');

		expect(claimed).toBe(true);
		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith({
			data: { id: '6f1c2b1e-0000-4000-8000-000000000001', consumer: 'exam.scoring' },
		});
	});

	it('claim returns false for an already processed event', async () => {
		const { service } = setup({ createError: { code: 'P2002' } });

		const claimed = await service.claim('6f1c2b1e-0000-4000-8000-000000000001', 'exam.scoring');

		expect(claimed).toBe(false);
	});

	it('claim rethrows errors other than P2002', async () => {
		const failure = { code: 'P2034' };
		const { service } = setup({ createError: failure });

		await expect(
			service.claim('6f1c2b1e-0000-4000-8000-000000000001', 'exam.scoring'),
		).rejects.toBe(failure);
	});

	it('claim returns true without writing for legacy messages', async () => {
		const { create, service } = setup();

		const claimed = await service.claim(undefined, 'exam.scoring');

		expect(claimed).toBe(true);
		expect(create).not.toHaveBeenCalled();
	});

	it('claim throws outside a transaction', async () => {
		const { create, service } = setup({ active: false });

		await expect(
			service.claim('6f1c2b1e-0000-4000-8000-000000000001', 'exam.scoring'),
		).rejects.toThrow('InboxService.claim must run inside a transaction');
		expect(create).not.toHaveBeenCalled();
	});
});
