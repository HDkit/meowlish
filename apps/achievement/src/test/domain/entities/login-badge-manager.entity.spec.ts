import {
	LoginBadgeManager,
	loginStreakDays,
} from '../../../domain/entities/login-badge-manager.entity';
import { Badge } from '../../../enums/badge.enum';

/** A row as the repository upserts it on a user's first login. */
const fresh = (createdAt: Date) =>
	new LoginBadgeManager({
		id: 'u1',
		version: 1,
		total: 0,
		longestStreak: 0,
		startedAt: createdAt,
		lastLogin: createdAt,
		badges: [],
	});

const loginAll = (logins: string[]) => {
	const manager = fresh(new Date(logins[0]));
	for (const at of logins) manager.updateProgress(new Date(at));
	return manager;
};

const streakOf = (m: LoginBadgeManager) => loginStreakDays(m.startedAt, m.lastLogin);

describe('LoginBadgeManager.updateProgress (UTC calendar days)', () => {
	it.each<[string, string[], { total: number; streak: number; longest: number }]>([
		['first login is day 1', ['2026-11-12T10:00:00Z'], { total: 1, streak: 1, longest: 1 }],
		[
			'same UTC day does not increment',
			['2026-11-12T00:00:00Z', '2026-11-12T23:59:59Z'],
			{ total: 1, streak: 1, longest: 1 },
		],
		[
			'23:59Z then 00:01Z the next day is consecutive',
			['2026-11-12T23:59:00Z', '2026-11-13T00:01:00Z'],
			{ total: 2, streak: 2, longest: 2 },
		],
		[
			'three consecutive UTC days',
			['2026-11-12T08:00:00Z', '2026-11-13T22:00:00Z', '2026-11-14T01:00:00Z'],
			{ total: 3, streak: 3, longest: 3 },
		],
		[
			'00:01Z then 23:59Z of the same day is not consecutive',
			['2026-11-12T00:01:00Z', '2026-11-12T23:59:00Z', '2026-11-14T00:00:00Z'],
			{ total: 2, streak: 1, longest: 1 },
		],
		[
			'a gap resets the streak to 1 and keeps the longest',
			[
				'2026-11-10T12:00:00Z',
				'2026-11-11T12:00:00Z',
				'2026-11-12T12:00:00Z',
				'2026-11-14T12:00:00Z',
			],
			{ total: 4, streak: 1, longest: 3 },
		],
		[
			'across a month and year boundary',
			['2026-12-31T23:30:00Z', '2027-01-01T00:30:00Z'],
			{ total: 2, streak: 2, longest: 2 },
		],
	])('%s', (_name, logins, expected) => {
		const m = loginAll(logins);
		expect({ total: m.total, streak: streakOf(m), longest: m.longestStreak }).toEqual(expected);
	});

	it('counts the first login even when the row was created a UTC day later', () => {
		// The row is upserted with `new Date()`; a delayed event carries an earlier login time.
		const m = fresh(new Date('2026-11-13T00:00:05Z'));
		m.updateProgress(new Date('2026-11-12T23:59:55Z'));
		m.updateProgress(new Date('2026-11-13T09:00:00Z'));
		expect({ total: m.total, streak: streakOf(m), longest: m.longestStreak }).toEqual({
			total: 2,
			streak: 2,
			longest: 2,
		});
	});

	it('ignores a login older than the last one', () => {
		const m = loginAll(['2026-11-12T10:00:00Z', '2026-11-13T10:00:00Z']);
		m.updateProgress(new Date('2026-11-12T11:00:00Z'));
		expect(m.lastLogin).toEqual(new Date('2026-11-13T10:00:00Z'));
		expect({ total: m.total, streak: streakOf(m) }).toEqual({ total: 2, streak: 2 });
	});

	it('awards the 7-day badges on the 7th consecutive day, not the 8th', () => {
		const days = Array.from({ length: 7 }, (_, i) => `2026-11-${String(10 + i)}T12:00:00Z`);
		const m = loginAll(days);
		expect(m.total).toBe(7);
		expect(m.badges).toEqual(new Set([Badge.LoginSevenDays, Badge.LoginSevenDaysStreak]));
	});

	it('awards the 14-day badges (they were never awarded before)', () => {
		const days = Array.from(
			{ length: 14 },
			(_, i) => `2026-11-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
		);
		const m = loginAll(days);
		expect(m.badges.has(Badge.LoginTwoWeeks)).toBe(true);
		expect(m.badges.has(Badge.LoginTwoWeeksStreak)).toBe(true);
	});

	it('catches up on badges whose target was reached before, at the next login', () => {
		// 27 login days, a best streak of 15, holding only the 7-day badges (as before the fix)
		const m = new LoginBadgeManager({
			id: 'u1',
			version: 1,
			total: 27,
			longestStreak: 15,
			startedAt: new Date('2026-11-10T08:00:00Z'),
			lastLogin: new Date('2026-11-11T08:00:00Z'),
			badges: [Badge.LoginSevenDays, Badge.LoginSevenDaysStreak],
		});
		m.updateProgress(new Date('2026-11-12T08:00:00Z'));
		// the current streak (3) is below the best (15), but the 14-day streak badge is still due
		expect(m.badges.has(Badge.LoginTwoWeeks)).toBe(true);
		expect(m.badges.has(Badge.LoginTwoWeeksStreak)).toBe(true);
		expect(m.badges.has(Badge.LoginOneMonth)).toBe(false);
	});

	describe('with a server time zone other than UTC', () => {
		const originalTz = process.env.TZ;
		afterEach(() => {
			process.env.TZ = originalTz;
		});

		it.each(['America/Los_Angeles', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati'])(
			'uses UTC day boundaries in %s',
			tz => {
				process.env.TZ = tz;
				// Same local day in every zone above, but two different UTC days.
				const m = loginAll(['2026-11-12T23:59:00Z', '2026-11-13T00:01:00Z']);
				expect({ total: m.total, streak: streakOf(m) }).toEqual({ total: 2, streak: 2 });
				// Different local days in those zones, but the same UTC day.
				const same = loginAll(['2026-11-12T00:01:00Z', '2026-11-12T23:59:00Z']);
				expect({ total: same.total, streak: streakOf(same) }).toEqual({ total: 1, streak: 1 });
			},
		);
	});
});
