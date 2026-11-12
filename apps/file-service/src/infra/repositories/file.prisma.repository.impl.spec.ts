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

describe('FilePrismaRepositoryImpl.getOrphanedFiles', () => {
	const rows = [
		{ id: 'sys', name: 'SYSTEM_a.mp3', refCount: 0, isSystem: true },
		{ id: 'user-lookalike', name: 'SYSTEM_x', refCount: 0, isSystem: false },
		{ id: 'plain', name: 'b.png', refCount: 0, isSystem: false },
		{ id: 'used', name: 'c.png', refCount: 1, isSystem: false },
	];
	// Minimal in-memory evaluation of the where clause the repository builds.
	const findMany = jest.fn(
		({ where }: { where: { refCount: { lte: number }; isSystem?: boolean } }) =>
			Promise.resolve(
				rows
					.filter(r => r.refCount <= where.refCount.lte)
					.filter(r => where.isSystem === undefined || r.isSystem === where.isSystem),
			),
	);
	const repo = new FilePrismaRepositoryImpl({ tx: { file: { findMany: findMany } } } as never);

	it('skips isSystem rows by flag, and cleans a user file named SYSTEM_x', async () => {
		const ids = (await repo.getOrphanedFiles()).map(f => f.id);
		expect(ids).toEqual(['user-lookalike', 'plain']);
		expect(JSON.stringify(findMany.mock.calls[0][0])).not.toContain('startsWith');
	});
});
