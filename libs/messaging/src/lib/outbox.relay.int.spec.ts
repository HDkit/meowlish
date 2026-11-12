import { OutboxRelay, type OutboxRelayPrisma } from './outbox.relay';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type PrismaCtor = new (o: { datasourceUrl?: string }) => RawPrisma;

interface RawPrisma extends OutboxRelayPrisma {
	$executeRawUnsafe(sql: string): Promise<number>;
	$disconnect(): Promise<void>;
}

const url = process.env['MESSAGING_IT_DATABASE_URL'];
const describeIt = url ? describe : describe.skip;

describeIt('OutboxRelay (integration)', () => {
	let prisma: RawPrisma;
	let workDir: string;
	let schemaName: string;
	let PrismaClient: PrismaCtor;

	beforeAll(async () => {
		// The lib has no generated client of its own: generate one from messaging.prisma into a temp dir.
		// Inside the repo so the Prisma CLI resolves @prisma/client instead of trying to auto-install it.
		const repoRoot = join(__dirname, '../../../..');
		mkdirSync(join(repoRoot, 'node_modules/.cache'), { recursive: true });
		workDir = mkdtempSync(join(repoRoot, 'node_modules/.cache/messaging-it-'));
		const schemaFile = join(workDir, 'schema.prisma');
		const model = readFileSync(join(__dirname, '../../prisma/messaging.prisma'), 'utf8');
		writeFileSync(
			schemaFile,
			`generator client {\n  provider = "prisma-client-js"\n  output = "${join(workDir, 'client')}"\n}\n` +
				`datasource db {\n  provider = "postgresql"\n  url = env("MESSAGING_IT_DATABASE_URL")\n}\n${model}`,
		);
		execFileSync(join(repoRoot, 'node_modules/.bin/prisma'), ['generate', '--schema', schemaFile], {
			cwd: repoRoot,
			stdio: 'pipe',
		});
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		({ PrismaClient } = require(join(workDir, 'client')) as { PrismaClient: PrismaCtor });
		// DDL comes from the model itself so the test cannot drift from messaging.prisma.
		const ddl = execFileSync(
			join(repoRoot, 'node_modules/.bin/prisma'),
			['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaFile, '--script'],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		// Random throwaway schema: the relay's unqualified table names resolve through the search_path
		// Prisma sets from `?schema=`.
		schemaName = `it_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
		const admin = new PrismaClient({ datasourceUrl: url });
		await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
		await admin.$disconnect();
		const scoped = new URL(url as string);
		scoped.searchParams.set('schema', schemaName);
		prisma = new PrismaClient({ datasourceUrl: scoped.toString() });
		for (const statement of ddl
			.split(/;\s*\n/)
			.map(x => x.trim())
			.filter(Boolean)) {
			await prisma.$executeRawUnsafe(statement);
		}
	}, 120_000);

	afterAll(async () => {
		if (prisma) {
			await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
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
