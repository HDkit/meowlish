import { ManagementPrismaRepositoryImpl } from '../../../infra/repositories/management.read.prisma.repository.impl';
import { PracticeReadPrismaRepositoryImpl } from '../../../infra/repositories/practice.read.prisma.repository.impl';
import { type Prisma } from '@prisma-client/exam';
import { SortDirection } from '@server/typing';

// The generated client can't load under Jest: a tiny Prisma.sql stand-in that renders the text.
jest.mock('@prisma-client/exam', () => {
	class Sql {
		constructor(
			public sql: string,
			public values: unknown[],
		) {}
	}
	const sql = (strings: TemplateStringsArray, ...vals: unknown[]) => {
		let text = strings[0];
		const values: unknown[] = [];
		vals.forEach((v, i) => {
			if (v instanceof Sql) {
				text += v.sql;
				values.push(...v.values);
			} else {
				text += '?';
				values.push(v);
			}
			text += strings[i + 1];
		});
		return new Sql(text, values);
	};
	return {
		Prisma: {
			sql: sql,
			raw: (text: string) => new Sql(text, []),
			join: (vals: unknown[]) => new Sql(vals.map(() => '?').join(', '), vals),
		},
	};
});

// C7: a backward page must be the rows immediately before the cursor, in forward order.
const flat = (sql: string) => sql.replace(/\s+/g, ' ');

describe('practice findExams pagination (C7)', () => {
	const setup = (rows: { id: string }[] = []) => {
		const queryRaw = jest.fn<Promise<{ id: string }[]>, [Prisma.Sql]>(() =>
			Promise.resolve(rows.map(r => ({ ...r }))),
		);
		const repo = new PracticeReadPrismaRepositoryImpl({ tx: { $queryRaw: queryRaw } } as never);
		const orderBy = () => {
			const sql = flat(queryRaw.mock.calls[0][0].sql);
			return /ORDER BY (.*?) LIMIT/.exec(sql)?.[1].trim();
		};
		return { repo: repo, queryRaw: queryRaw, orderBy: orderBy };
	};

	it.each([
		['updatedAt', SortDirection.DESC, 1, 'e.updated_at DESC, e.id ASC'],
		['updatedAt', SortDirection.DESC, -1, 'e.updated_at ASC, e.id DESC'],
		['updatedAt', SortDirection.ASC, 1, 'e.updated_at ASC, e.id ASC'],
		['updatedAt', SortDirection.ASC, -1, 'e.updated_at DESC, e.id DESC'],
		['attemptsCount', SortDirection.DESC, 1, '"attemptsCount" DESC, e.id ASC'],
		['attemptsCount', SortDirection.DESC, -1, '"attemptsCount" ASC, e.id DESC'],
		['attemptsCount', SortDirection.ASC, 1, '"attemptsCount" ASC, e.id ASC'],
		['attemptsCount', SortDirection.ASC, -1, '"attemptsCount" DESC, e.id DESC'],
	] as const)('sort %s %s, direction %p orders by %s', async (key, direction, dir, expected) => {
		const { repo, orderBy } = setup();
		await repo.findExams({
			sortBy: { key: key, direction: direction },
			lastCursor: { id: 'x', updatedAt: new Date(0), attemptsCount: 3 },
			direction: dir,
		});
		expect(orderBy()).toBe(expected);
	});

	it.each([
		[1, 'e.id ASC'],
		[-1, 'e.id DESC'],
	])('without sort, direction %p orders by %s', async (dir, expected) => {
		const { repo, orderBy } = setup();
		await repo.findExams({ lastCursor: { id: 'x' }, direction: dir });
		expect(orderBy()).toBe(expected);
	});

	it('returns a backward page in forward order', async () => {
		const { repo } = setup([{ id: 'c' }, { id: 'b' }, { id: 'a' }]);
		const rows = await repo.findExams({ lastCursor: { id: 'd' }, direction: -1 });
		expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c']);
	});

	it('keeps the sort order whitelisted', async () => {
		const { repo, orderBy } = setup();
		await repo.findExams({
			sortBy: { key: 'updatedAt', direction: 'ASC; DROP TABLE exams' as SortDirection },
			direction: -1,
		});
		expect(orderBy()).toBe('e.updated_at ASC, e.id DESC');
	});
});

describe('management findExams pagination (C7)', () => {
	const setup = () => {
		const findMany = jest.fn<Promise<unknown[]>, [Prisma.ExamFindManyArgs]>().mockResolvedValue([]);
		const repo = new ManagementPrismaRepositoryImpl({
			tx: { exam: { findMany: findMany } },
		} as never);
		const args = () => findMany.mock.calls[0][0];
		return { repo: repo, args: args };
	};

	it.each([1, -1])(
		'keeps the forward order with direction %p (Prisma flips it for take < 0)',
		async dir => {
			const { repo, args } = setup();
			await repo.findExams({
				sortBy: { key: 'updatedAt', direction: SortDirection.DESC },
				lastId: 'x',
				limit: 5,
				direction: dir,
			});
			expect(args().orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'asc' }]);
			expect(args().take).toBe(dir * 5);
			expect(args().cursor).toEqual({ id: 'x' });
			expect(args().skip).toBe(1);
		},
	);

	it('filters updatedTimeRange on updatedAt', async () => {
		const { repo, args } = setup();
		const created = { from: new Date(1), to: new Date(2) };
		const updated = { from: new Date(3), to: new Date(4) };
		await repo.findExams({ filter: { createdTimeRange: created, updatedTimeRange: updated } });
		expect(args().where).toEqual({
			createdAt: { gt: created.from, lt: created.to },
			updatedAt: { gt: updated.from, lt: updated.to },
		});
	});
});
