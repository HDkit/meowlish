import { BadgeReadPrismaRepositoryImpl } from '../../../infra/repositories/badge.read.prisma.repository.impl';

describe('BadgeReadPrismaRepositoryImpl.getUsersProgress', () => {
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
		['a single UTC day is a 1-day streak', '2026-11-12T00:01:00Z', '2026-11-12T23:59:00Z', 1],
		[
			'23:59Z to 00:01Z next day is a 2-day streak',
			'2026-11-12T23:59:00Z',
			'2026-11-13T00:01:00Z',
			2,
		],
		['three UTC dates are a 3-day streak', '2026-11-12T12:00:00Z', '2026-11-14T00:00:00Z', 3],
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
