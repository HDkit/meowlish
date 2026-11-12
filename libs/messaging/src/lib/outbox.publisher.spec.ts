import { OutboxPublisher, type OutboxTransactionHost } from './outbox.publisher';

type CreateArgs = Parameters<OutboxTransactionHost['tx']['outboxEvent']['create']>[0];

describe('OutboxPublisher', () => {
	function setup(active: boolean) {
		const create = jest.fn<Promise<unknown>, [CreateArgs]>().mockResolvedValue(undefined);
		const txHost = { isTransactionActive: () => active, tx: { outboxEvent: { create: create } } };
		return { create: create, publisher: new OutboxPublisher(txHost) };
	}

	it('add writes the envelope to the outbox', async () => {
		const { create, publisher } = setup(true);

		const envelope = await publisher.add('exam.attempt.scored', { score: 9 });

		expect(create).toHaveBeenCalledTimes(1);
		const { data } = create.mock.calls[0][0];
		expect(data.routingKey).toBe('exam.attempt.scored');
		expect((data.payload as { type: string }).type).toBe('exam.attempt.scored');
		expect(data.payload).toEqual(envelope);
		expect(data.id).toBe(envelope.id);
		expect(envelope.payload).toEqual({ score: 9 });
	});

	it('add with bare stores the payload unwrapped', async () => {
		const { create, publisher } = setup(true);

		const envelope = await publisher.add(
			'exam.writing.submitted',
			{ attempt_id: 'a1' },
			{ bare: true },
		);

		const { data } = create.mock.calls[0][0];
		expect(data.routingKey).toBe('exam.writing.submitted');
		expect(data.payload).toEqual({ attempt_id: 'a1' });
		expect(data.id).toBe(envelope.id);
	});

	it('add throws when no transaction is active', async () => {
		const { create, publisher } = setup(false);

		await expect(publisher.add('x.y', {})).rejects.toThrow(
			'OutboxPublisher.add must run inside a transaction',
		);
		expect(create).not.toHaveBeenCalled();
	});
});
