import { GetUserActivityQuery } from '../../practice/exam.get-user-activity.query';
import { GetUserActivityQueryHandler } from './get-user-activity.handler';

describe('GetUserActivityQueryHandler', () => {
	const make = () => {
		const repo = { getUserActivityDays: jest.fn().mockResolvedValue([]) };
		return { repo: repo, handler: new GetUserActivityQueryHandler(repo as never) };
	};

	it("reads only the requester's days", async () => {
		const { repo, handler } = make();
		await handler.execute(new GetUserActivityQuery({ userId: 'u1' }));
		expect(repo.getUserActivityDays).toHaveBeenCalledWith('u1');
	});

	it('defaults to 182 days and clamps the range', async () => {
		const { handler } = make();
		const span = async (days?: number) => {
			const a = await handler.execute(new GetUserActivityQuery({ userId: 'u1', days: days }));
			return (Date.parse(a.to) - Date.parse(a.from)) / 86_400_000 + 1;
		};
		expect(await span()).toBe(182);
		expect(await span(0)).toBe(1);
		expect(await span(10_000)).toBe(371);
	});
});
