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
