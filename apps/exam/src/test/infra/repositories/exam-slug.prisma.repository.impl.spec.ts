import { ExamSlugPrismaRepositoryImpl } from '../../../infra/repositories/exam-slug.prisma.repository.impl';
import { Prisma } from '@prisma-client/exam';

jest.mock('@prisma-client/exam', () => ({
	Prisma: {
		PrismaClientKnownRequestError: class extends Error {
			constructor(public code: string) {
				super(code);
			}
		},
	},
}));

const setup = (opts: { current?: string | null; taken?: string[] } = {}) => {
	const tx = {
		exam: {
			findUnique: jest.fn().mockResolvedValue({ slug: opts.current ?? null }),
			findMany: jest.fn().mockResolvedValue((opts.taken ?? []).map(s => ({ slug: s }))),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		},
	};
	return { tx: tx, repo: new ExamSlugPrismaRepositoryImpl({ tx: tx } as never) };
};

describe('ExamSlugPrismaRepositoryImpl.assignSlug', () => {
	it('makes a slug from the title, adding a number when it is taken', async () => {
		const { tx, repo } = setup({ taken: ['ielts-writing-6'] });
		await expect(repo.assignSlug('e1', 'IELTS Writing 6')).resolves.toBe('ielts-writing-6-2');
		expect(tx.exam.updateMany).toHaveBeenCalledWith({
			where: { id: 'e1', slug: null },
			data: { slug: 'ielts-writing-6-2' },
		});
	});

	it('keeps an existing slug (titles can change, links must not)', async () => {
		const { tx, repo } = setup({ current: 'old-title' });
		await expect(repo.assignSlug('e1', 'New title')).resolves.toBe('old-title');
		expect(tx.exam.updateMany).not.toHaveBeenCalled();
	});

	it('retries when another writer took the same slug first', async () => {
		const { tx, repo } = setup();
		const KnownError = Prisma.PrismaClientKnownRequestError as unknown as new (
			code: string,
		) => Error;
		const conflict = new KnownError('P2002');
		tx.exam.updateMany.mockRejectedValueOnce(conflict).mockResolvedValueOnce({ count: 1 });
		tx.exam.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ slug: 'toeic-lr-1' }]);
		await expect(repo.assignSlug('e1', 'TOEIC LR 1')).resolves.toBe('toeic-lr-1-2');
	});
});
