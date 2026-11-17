import {
	buildUserActivity,
	computeStreaks,
	isDayKey,
	lastDays,
	rangeLength,
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
		const activity = buildUserActivity([], now, lastDays(now, 7));
		expect(activity).toMatchObject({
			from: '2026-11-07',
			to: '2026-11-13',
			today: '2026-11-13',
			days: [],
		});
	});

	it('returns only in-range active days, but all-time totals and streaks', () => {
		const activity = buildUserActivity(
			[
				{ date: '2026-01-01', attempts: 2, seconds: 600 },
				{ date: '2026-11-12', attempts: 1, seconds: 89 },
				{ date: '2026-11-13', attempts: 3, seconds: 3600 },
			],
			now,
			lastDays(now, 30),
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

describe('activity ranges', () => {
	const now = new Date('2026-11-13T22:30:00Z');
	const rows = [
		{ date: '2025-12-31', attempts: 1, seconds: 60 },
		{ date: '2026-01-01', attempts: 2, seconds: 600 },
		{ date: '2026-01-31', attempts: 1, seconds: 120 },
		{ date: '2026-02-01', attempts: 1, seconds: 60 },
		{ date: '2026-11-13', attempts: 1, seconds: 60 },
	];

	it('returns only the days of a past range, with streaks still counted up to today', () => {
		const activity = buildUserActivity(rows, now, { from: '2026-01-01', to: '2026-01-31' });
		expect(activity.days.map(d => d.date)).toEqual(['2026-01-01', '2026-01-31']);
		expect(activity).toMatchObject({
			from: '2026-01-01',
			to: '2026-01-31',
			today: '2026-11-13',
			currentStreak: 1,
			activeDays: 5,
			totalAttempts: 6,
		});
	});

	it('checks day keys and counts both ends', () => {
		expect(isDayKey('2026-02-28')).toBe(true);
		expect(isDayKey('2026-02-30')).toBe(false);
		expect(isDayKey('2026-2-1')).toBe(false);
		expect(rangeLength({ from: '2026-01-01', to: '2026-01-31' })).toBe(31);
		expect(rangeLength(lastDays(now, 371))).toBe(371);
	});
});
