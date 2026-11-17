import { BadgeReadPrismaRepositoryImpl } from '../../../infra/repositories/badge.read.prisma.repository.impl';

describe('BadgeReadPrismaRepositoryImpl.getUsersProgress', () => {
	// "Now" is 2026-11-14 10:00Z unless a test says otherwise.
	beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-14T10:00:00Z') }));
	afterEach(() => jest.useRealTimers());

	const setup = (login: { startedAt: string; lastLogin: string } | null) => {
		const tx = {
			loginCriteria: {
				findUnique: jest.fn().mockResolvedValue(
					login && {
						total: 5,
						longestStreak: 4,
						startedAt: new Date(login.startedAt),
						lastLogin: new Date(login.lastLogin),
					},
				),
			},
			attemptCriteria: { findUnique: jest.fn().mockResolvedValue(null) },
		};
		return new BadgeReadPrismaRepositoryImpl({ tx: tx } as never);
	};

	it.each([
		['a single UTC day is a 1-day streak', '2026-11-13T00:01:00Z', '2026-11-13T23:59:00Z', 1],
		[
			'23:59Z to 00:01Z next day is a 2-day streak',
			'2026-11-12T23:59:00Z',
			'2026-11-13T00:01:00Z',
			2,
		],
		['three UTC dates are a 3-day streak', '2026-11-12T12:00:00Z', '2026-11-14T00:00:00Z', 3],
		[
			'a streak whose last login was yesterday is still current',
			'2026-11-11T08:00:00Z',
			'2026-11-13T23:59:00Z',
			3,
		],
		[
			'a streak whose last login was two UTC days ago reads as 0',
			'2026-11-10T08:00:00Z',
			'2026-11-12T23:59:00Z',
			0,
		],
		['a streak that ended weeks ago reads as 0', '2026-10-01T08:00:00Z', '2026-10-20T08:00:00Z', 0],
	])('%s', async (_name, startedAt, lastLogin, streak) => {
		const progress = await setup({ startedAt: startedAt, lastLogin: lastLogin }).getUsersProgress(
			'u1',
		);
		expect(progress.loginProgress).toEqual({ streak: streak, longestStreak: 4, total: 5 });
	});

	it('has no login progress before the first login', async () => {
		const progress = await setup(null).getUsersProgress('u1');
		expect(progress.loginProgress).toBeUndefined();
	});
});
