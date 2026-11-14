import { ExamSlugBackfill } from '../../../app/services/exam-slug-backfill.service';

jest.mock('nestjs-cls', () => ({
	...jest.requireActual<object>('nestjs-cls'),
	UseCls: () => () => undefined,
}));

describe('ExamSlugBackfill', () => {
	it('gives every exam without a slug one, batch by batch', async () => {
		const repo = {
			findWithoutSlug: jest
				.fn()
				.mockResolvedValueOnce([
					{ id: '1', title: 'TOEIC LR 1' },
					{ id: '5', title: 'TOEIC Reading 2' },
				])
				.mockResolvedValueOnce([]),
			assignSlug: jest.fn().mockResolvedValue('x'),
		};
		const backfill = new ExamSlugBackfill(repo, { log: jest.fn(), error: jest.fn() } as never);
		await expect(backfill.run()).resolves.toBe(2);
		expect(repo.assignSlug.mock.calls).toEqual([
			['1', 'TOEIC LR 1'],
			['5', 'TOEIC Reading 2'],
		]);
	});
});
