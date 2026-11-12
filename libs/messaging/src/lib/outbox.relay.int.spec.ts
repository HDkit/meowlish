import { OutboxRelay, type OutboxRelayPrisma } from './outbox.relay';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface RawPrisma extends OutboxRelayPrisma {
	$executeRawUnsafe(sql: string): Promise<number>;
	$disconnect(): Promise<void>;
}

const url = process.env['MESSAGING_IT_DATABASE_URL'];
const describeIt = url ? describe : describe.skip;

describeIt('OutboxRelay (integration)', () => {
	let prisma: RawPrisma;
	let workDir: string;

	beforeAll(async () => {
		// The lib has no generated client of its own: generate one from messaging.prisma into a temp dir.
		// Inside the repo so the Prisma CLI resolves @prisma/client instead of trying to auto-install it.
		const repoRoot = join(__dirname, '../../../..');
		mkdirSync(join(repoRoot, 'node_modules/.cache'), { recursive: true });
		workDir = mkdtempSync(join(repoRoot, 'node_modules/.cache/messaging-it-'));
		const model = readFileSync(join(__dirname, '../../prisma/messaging.prisma'), 'utf8');
		writeFileSync(
			join(workDir, 'schema.prisma'),
			`generator client {\n  provider = "prisma-client-js"\n  output = "${join(workDir, 'client')}"\n}\n` +
				`datasource db {\n  provider = "postgresql"\n  url = env("MESSAGING_IT_DATABASE_URL")\n}\n${model}`,
		);
		execFileSync(
			join(repoRoot, 'node_modules/.bin/prisma'),
			['generate', '--schema', join(workDir, 'schema.prisma')],
			{
				cwd: repoRoot,
				stdio: 'pipe',
			},
		);
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { PrismaClient } = require(join(workDir, 'client')) as {
			PrismaClient: new (o: { datasourceUrl?: string }) => RawPrisma;
		};
		prisma = new PrismaClient({ datasourceUrl: url });
		await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS outbox_events');
		await prisma.$executeRawUnsafe(`CREATE TABLE outbox_events (
			id uuid PRIMARY KEY, routing_key text NOT NULL, payload jsonb NOT NULL,
			created_at timestamp(3) NOT NULL DEFAULT now(), published_at timestamp(3),
			attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamp(3) NOT NULL DEFAULT now(),
			last_error text)`);
		await prisma.$executeRawUnsafe(
			'CREATE INDEX ON outbox_events (published_at, next_attempt_at, created_at)',
		);
	}, 120_000);

	afterAll(async () => {
		if (prisma) {
			await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS outbox_events');
			await prisma.$disconnect();
		}
		if (workDir) rmSync(workDir, { recursive: true, force: true });
	});

	it('two concurrent relays never publish the same row', async () => {
		for (let i = 0; i < 50; i++) {
			const id = randomUUID();
			await prisma.$executeRaw`INSERT INTO outbox_events (id, routing_key, payload)
				VALUES (${id}::uuid, 'it.event', ${JSON.stringify({ id: id })}::jsonb)`;
		}
		const seen: string[] = [];
		const publish = async (_e: string, _rk: string, _p: unknown, o: { messageId: string }) => {
			await new Promise(r => setTimeout(r, 2));
			seen.push(o.messageId);
		};
		const amqp = { getConnection: () => ({ publish: publish }) };
		const make = () =>
			new OutboxRelay(prisma, amqp as never, {
				serviceName: 'it',
				connectionName: 'pub',
			});

		const results = await Promise.all([make().relayOnce(), make().relayOnce()]);

		expect(results[0] + results[1]).toBe(50);
		expect(seen).toHaveLength(50);
		expect(new Set(seen).size).toBe(50);
		const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
			SELECT count(*)::int AS n FROM outbox_events WHERE published_at IS NULL`;
		expect(n).toBe(0);
	});
});
