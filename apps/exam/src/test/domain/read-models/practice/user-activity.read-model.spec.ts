import {
	buildUserActivity,
	computeStreaks,
	utcDayKey,
} from '../../../../domain/read-models/practice/user-activity.read-model';

describe('computeStreaks', () => {
	it('is zero without activity', () => {
		expect(computeStreaks([], '2026-11-13')).toEqual({ current: 0, longest: 0 });
	});

	it('counts the run ending today', () => {
		expect(computeStreaks(['2026-11-11', '2026-11-12', '2026-11-13'], '2026-11-13')).toEqual({
			current: 3,
			longest: 3,
		});
	});

	it('keeps the streak alive until the day after the last active day ends', () => {
		expect(computeStreaks(['2026-11-11', '2026-11-12'], '2026-11-13').current).toBe(2);
		expect(computeStreaks(['2026-11-11', '2026-11-12'], '2026-11-14').current).toBe(0);
	});

	it('tracks the longest run separately, across month ends and duplicates', () => {
		const days = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-01', '2026-11-05'];
		expect(computeStreaks(days, '2026-11-05')).toEqual({ current: 1, longest: 3 });
	});
});

describe('buildUserActivity', () => {
	const now = new Date('2026-11-13T22:30:00Z');

	it('uses UTC days for the range and today', () => {
		expect(utcDayKey(new Date('2026-11-13T23:59:59Z'))).toBe('2026-11-13');
		const activity = buildUserActivity([], now, 7);
		expect(activity).toMatchObject({ from: '2026-11-07', to: '2026-11-13', days: [] });
	});

	it('returns only in-range active days, but all-time totals and streaks', () => {
		const activity = buildUserActivity(
			[
				{ date: '2026-01-01', attempts: 2, seconds: 600 },
				{ date: '2026-11-12', attempts: 1, seconds: 89 },
				{ date: '2026-11-13', attempts: 3, seconds: 3600 },
			],
			now,
			30,
		);
		expect(activity.days).toEqual([
			{ date: '2026-11-12', attempts: 1, minutes: 1 },
			{ date: '2026-11-13', attempts: 3, minutes: 60 },
		]);
		expect(activity).toMatchObject({
			currentStreak: 2,
			longestStreak: 2,
			activeDays: 3,
			totalAttempts: 6,
		});
	});
});
