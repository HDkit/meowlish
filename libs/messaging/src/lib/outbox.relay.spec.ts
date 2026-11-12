import { OutboxRelay, type OutboxRelayPrisma } from './outbox.relay';

interface Row {
	id: string;
	routingKey: string;
	payload: unknown;
	attempts: number;
	nextAttemptAt: number;
	publishedAt: number | null;
	lastError: string | null;
}

const sqlText = (s: TemplateStringsArray): string => s.join('?').replace(/\s+/g, ' ');

function setup(rows: Row[], publish: jest.Mock = jest.fn().mockResolvedValue(undefined)) {
	const selects = jest.fn();
	const executed: string[] = [];
	const tx = {
		$queryRaw: jest.fn((s: TemplateStringsArray) => {
			selects(sqlText(s));
			return rows
				.filter(r => r.publishedAt === null && r.nextAttemptAt <= Date.now())
				.map(r => ({
					id: r.id,
					routing_key: r.routingKey,
					payload: r.payload,
					attempts: r.attempts,
				}));
		}),
		$executeRaw: jest.fn((s: TemplateStringsArray, ...v: unknown[]) => {
			const text = sqlText(s);
			executed.push(text);
			if (text.includes('SET published_at')) {
				const row = rows.find(r => r.id === v[0]);
				if (row) row.publishedAt = Date.now();
			} else if (text.includes('SET attempts')) {
				const row = rows.find(r => r.id === v[3]);
				if (row) {
					row.attempts = v[0] as number;
					row.nextAttemptAt = Date.now() + (v[1] as number) * 1000;
					row.lastError = v[2] as string;
				}
			}
			return Promise.resolve(1);
		}),
	};
	const prisma = {
		...tx,
		$transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
	};
	const amqp = { getConnection: jest.fn().mockReturnValue({ publish: publish }) };
	const relay = new OutboxRelay(prisma as unknown as OutboxRelayPrisma, amqp as never, {
		serviceName: 'svc',
		connectionName: 'pub',
	});
	return { relay: relay, prisma: prisma, publish: publish, executed: executed, selects: selects };
}

const row = (id: string, attempts = 0): Row => ({
	id: id,
	routingKey: `rk.${id}`,
	payload: { id: id },
	attempts: attempts,
	nextAttemptAt: 0,
	publishedAt: null,
	lastError: null,
});

describe('OutboxRelay', () => {
	afterEach(() => jest.useRealTimers());

	it('publishes pending rows oldest first and marks them published', async () => {
		const rows = [row('a'), row('b')];
		const { relay, publish, selects } = setup(rows);

		await expect(relay.relayOnce()).resolves.toBe(2);

		expect((selects.mock.calls as string[][])[0][0]).toMatch(
			/ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED/,
		);
		expect((publish.mock.calls as unknown[][]).map(c => c[1])).toEqual(['rk.a', 'rk.b']);
		expect(publish).toHaveBeenCalledWith(
			'eventbus',
			'rk.a',
			{ id: 'a' },
			{ persistent: true, messageId: 'a' },
		);
		expect(rows.every(r => r.publishedAt !== null)).toBe(true);
	});

	it('backs off after a publish failure and retries later', async () => {
		jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
		const rows = [row('a'), row('b'), row('c')];
		const publish = jest
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('nack'))
			.mockResolvedValue(undefined);
		const { relay } = setup(rows, publish);

		await expect(relay.relayOnce()).resolves.toBe(1);

		expect(publish).toHaveBeenCalledTimes(2);
		expect(rows[0].publishedAt).not.toBeNull();
		expect(rows[1]).toMatchObject({ attempts: 1, lastError: 'nack' });
		expect(rows[1].nextAttemptAt).toBe(Date.now() + 2000);
		expect(rows[2].publishedAt).toBeNull();

		jest.setSystemTime(Date.now() + 2500);
		await expect(relay.relayOnce()).resolves.toBe(2);
		expect(rows.every(r => r.publishedAt !== null)).toBe(true);
	});

	it('caps back-off at 300 seconds', async () => {
		jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
		const rows = [row('a', 20)];
		const { relay } = setup(rows, jest.fn().mockRejectedValue(new Error('down')));

		await relay.relayOnce();

		expect(rows[0].attempts).toBe(21);
		expect(rows[0].nextAttemptAt).toBeLessThanOrEqual(Date.now() + 300_000);
	});

	it('does not overlap runs', async () => {
		const { relay, selects } = setup([row('a')]);

		await Promise.all([relay.relayOnce(), relay.relayOnce()]);

		expect(selects).toHaveBeenCalledTimes(1);
	});

	it('cleanup deletes rows older than 7 days', async () => {
		const { relay, executed } = setup([]);

		await relay.cleanup();

		expect(executed).toHaveLength(2);
		expect(executed[0]).toMatch(
			/DELETE FROM outbox_events WHERE published_at < now\(\) - interval '7 days'/,
		);
		expect(executed[1]).toMatch(
			/DELETE FROM inbox_events WHERE processed_at < now\(\) - interval '7 days'/,
		);
	});
});
