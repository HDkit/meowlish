import { FilePrismaRepositoryImpl } from './file.prisma.repository.impl';

describe('FilePrismaRepositoryImpl.decrementRef', () => {
	const setup = (known: string[]) => {
		let inFlight = 0;
		let maxInFlight = 0;
		const updateMany = jest.fn(async ({ where }: { where: { id: string } }) => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await Promise.resolve();
			inFlight--;
			return { count: known.includes(where.id) ? 1 : 0 };
		});
		const repo = new FilePrismaRepositoryImpl({
			tx: { file: { updateMany: updateMany } },
		} as never);
		return { repo: repo, updateMany: updateMany, maxInFlight: () => maxInFlight };
	};

	it('skips an unknown id and still decrements the others', async () => {
		const { repo, updateMany } = setup(['a', 'c']);

		await expect(
			repo.decrementRef([{ id: 'a', count: 2 }, { id: 'missing' }, { id: 'c' }]),
		).resolves.toBeUndefined();

		expect(updateMany.mock.calls.map(([args]) => args)).toEqual([
			{ where: { id: 'a' }, data: { refCount: { decrement: 2 } } },
			{ where: { id: 'missing' }, data: { refCount: { decrement: 1 } } },
			{ where: { id: 'c' }, data: { refCount: { decrement: 1 } } },
		]);
	});

	it('runs the updates sequentially in the shared transaction', async () => {
		const { repo, maxInFlight } = setup(['a', 'b', 'c']);
		await repo.decrementRef([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
		expect(maxInFlight()).toBe(1);
	});

	it('propagates real database errors', async () => {
		const { repo, updateMany } = setup(['a']);
		updateMany.mockRejectedValueOnce(new Error('connection lost'));
		await expect(repo.decrementRef([{ id: 'a' }])).rejects.toThrow('connection lost');
	});
});

describe('FilePrismaRepositoryImpl.lockOrphanedFiles', () => {
	const setup = () => {
		const queryRaw = jest.fn().mockResolvedValue([{ id: 'a', isPublic: true }]);
		const repo = new FilePrismaRepositoryImpl({ tx: { $queryRaw: queryRaw } } as never);
		const sql = () => {
			const [strings] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
			return strings.join('?').replace(/\s+/g, ' ');
		};
		const params = () => (queryRaw.mock.calls[0] as unknown[]).slice(1);
		return { repo: repo, sql: sql, params: params };
	};

	it('locks unreferenced, non-system rows untouched since the cutoff, skipping locked ones', async () => {
		const { repo, sql, params } = setup();
		const cutoff = new Date('2026-11-12T11:00:00Z');
		await expect(repo.lockOrphanedFiles(cutoff, 100)).resolves.toEqual([
			{ id: 'a', isPublic: true },
		]);
		expect(sql()).toContain('"ref_count" <= 0');
		expect(sql()).toContain('"is_system" = false');
		expect(sql()).toContain('"updatedAt" < ?::timestamp');
		expect(sql()).toContain('LIMIT ? FOR UPDATE SKIP LOCKED');
		expect(sql()).not.toContain('startsWith');
		expect(params()).toEqual(['2026-11-12T11:00:00.000Z', 100]);
	});
});

describe('FilePrismaRepositoryImpl.removeOrphaned', () => {
	it('re-checks that the rows are still unreferenced and not system files', async () => {
		const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
		const repo = new FilePrismaRepositoryImpl({
			tx: { file: { deleteMany: deleteMany } },
		} as never);
		await repo.removeOrphaned(['a', 'b']);
		expect(deleteMany).toHaveBeenCalledWith({
			where: { id: { in: ['a', 'b'] }, refCount: { lte: 0 }, isSystem: false },
		});
	});

	it('skips the query for an empty list', async () => {
		const deleteMany = jest.fn();
		const repo = new FilePrismaRepositoryImpl({
			tx: { file: { deleteMany: deleteMany } },
		} as never);
		await repo.removeOrphaned([]);
		expect(deleteMany).not.toHaveBeenCalled();
	});
});
