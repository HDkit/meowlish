import { FindExamsHandler } from '../../../../../app/queries/handlers/practice/find-exams.handler';
import { FindExamsQuery } from '../../../../../app/queries/practice/exam.find-exams.query';

const setup = () => {
	const repo = {
		findExams: jest.fn().mockResolvedValue([{ id: 'e7' }]),
		countExams: jest.fn().mockResolvedValue(23),
	};
	const helper = { encodeCursor: jest.fn(() => 'cursor'), decodeCursor: jest.fn() };
	const handler = new FindExamsHandler({ create: () => helper } as never, repo as never);
	return { repo: repo, handler: handler };
};

describe('FindExamsHandler', () => {
	it('page mode: numbered page plus the total, no cursors', async () => {
		const { repo, handler } = setup();
		const filter = { requiredTags: ['TOEIC'] };
		const res = await handler.execute(new FindExamsQuery({ filter: filter, limit: 6, page: 3 }));
		expect(repo.findExams).toHaveBeenCalledWith({
			filter: filter,
			sortBy: undefined,
			limit: 6,
			page: 3,
		});
		expect(repo.countExams).toHaveBeenCalledWith(filter);
		expect(res).toEqual({ exams: [{ id: 'e7' }], nextCursor: '', prevCursor: '', totalCount: 23 });
	});

	it('cursor mode stays the default and returns cursors', async () => {
		const { repo, handler } = setup();
		const res = await handler.execute(new FindExamsQuery({ limit: 6 }));
		expect(repo.countExams).not.toHaveBeenCalled();
		expect(res.nextCursor).toBe('cursor');
		expect(res.totalCount).toBeUndefined();
	});
});
