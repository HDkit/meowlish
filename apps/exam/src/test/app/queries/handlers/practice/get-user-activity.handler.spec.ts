import { GetUserActivityQueryHandler } from '../../../../../app/queries/handlers/practice/get-user-activity.handler';
import { GetUserActivityQuery } from '../../../../../app/queries/practice/exam.get-user-activity.query';

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

	it('serves an explicit range, even one in the past', async () => {
		const { handler } = make();
		const a = await handler.execute(
			new GetUserActivityQuery({ userId: 'u1', from: '2025-02-01', to: '2025-02-28' }),
		);
		expect(a).toMatchObject({ from: '2025-02-01', to: '2025-02-28' });
		expect(a.today).toBe(new Date().toISOString().slice(0, 10));
	});

	it('treats empty from/to (proto3 wrappers) as absent', async () => {
		const { handler } = make();
		const a = await handler.execute(new GetUserActivityQuery({ userId: 'u1', from: '', to: '' }));
		expect((Date.parse(a.to) - Date.parse(a.from)) / 86_400_000 + 1).toBe(182);
	});

	it.each([
		[{ from: '2026-01-01', to: '2026-01-31', days: 30 }, 'not both'],
		[{ from: '2026-01-01' }, 'together'],
		[{ to: '2026-01-31' }, 'together'],
		[{ from: '2026-02-30', to: '2026-03-01' }, 'YYYY-MM-DD'],
		[{ from: '2026-02-01', to: '2026-01-01' }, 'not be after'],
		[{ from: '2025-01-01', to: '2026-01-07' }, 'at most 371'],
	])('refuses %o', async (range, message) => {
		const { repo, handler } = make();
		await expect(
			handler.execute(new GetUserActivityQuery({ userId: 'u1', ...range })),
		).rejects.toThrow(message);
		expect(repo.getUserActivityDays).not.toHaveBeenCalled();
	});
});
