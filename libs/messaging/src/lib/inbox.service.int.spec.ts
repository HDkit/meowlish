import { InboxService, type InboxTransactionHost } from './inbox.service';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type TxClient = InboxTransactionHost['tx'] & {
	$queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

type PrismaCtor = new (o: { datasourceUrl?: string }) => RawPrisma;

interface RawPrisma {
	$transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T>;
	$queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
	$executeRawUnsafe(sql: string): Promise<number>;
	$disconnect(): Promise<void>;
}

const url = process.env['MESSAGING_IT_DATABASE_URL'];
const describeIt = url ? describe : describe.skip;

describeIt('InboxService (integration)', () => {
	let prisma: RawPrisma;
	let workDir: string;
	let schemaName: string;

	const options = { serviceName: 'it' };
	// The CLS TransactionHost needs a Nest app; this host wraps the real interactive tx client instead.
	const serviceOver = (tx: TxClient) =>
		new InboxService({ isTransactionActive: () => true, tx: tx }, options);

	beforeAll(async () => {
		// The lib has no generated client of its own: generate one from messaging.prisma into a temp dir.
		// Inside the repo so the Prisma CLI resolves @prisma/client instead of trying to auto-install it.
		const repoRoot = join(__dirname, '../../../..');
		mkdirSync(join(repoRoot, 'node_modules/.cache'), { recursive: true });
		workDir = mkdtempSync(join(repoRoot, 'node_modules/.cache/messaging-inbox-it-'));
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
		const { PrismaClient } = require(join(workDir, 'client')) as { PrismaClient: PrismaCtor };
		// DDL comes from the model itself so the test cannot drift from messaging.prisma.
		const ddl = execFileSync(
			join(repoRoot, 'node_modules/.bin/prisma'),
			['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaFile, '--script'],
			{ cwd: repoRoot, encoding: 'utf8' },
		);
		// Random throwaway schema: unqualified table names resolve through the search_path
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

	it('a duplicate claim leaves the transaction usable', async () => {
		const id = randomUUID();

		const first = await prisma.$transaction(tx => serviceOver(tx).claim(id, 'q'));
		expect(first).toBe(true);

		// The duplicate must not abort the transaction: a later statement in the same tx still runs
		// and the transaction commits.
		const { duplicate, rows } = await prisma.$transaction(async tx => {
			const duplicate = await serviceOver(tx).claim(id, 'q');
			const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
				SELECT count(*)::int AS n FROM inbox_events WHERE id = ${id}::uuid`;
			return { duplicate: duplicate, rows: n };
		});
		expect(duplicate).toBe(false);
		expect(rows).toBe(1);
	});

	it('dedup is per consumer', async () => {
		const id = randomUUID();
		await prisma.$transaction(tx => serviceOver(tx).claim(id, 'q'));

		const other = await prisma.$transaction(tx => serviceOver(tx).claim(id, 'other-consumer'));

		expect(other).toBe(true);
		const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
			SELECT count(*)::int AS n FROM inbox_events WHERE id = ${id}::uuid`;
		expect(n).toBe(2);
	});
});
