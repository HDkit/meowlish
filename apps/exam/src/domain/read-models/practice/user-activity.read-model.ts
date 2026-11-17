/** Finished attempts on one UTC day, as stored. */
export type ActivityDayRow = {
	/** YYYY-MM-DD (UTC) */
	date: string;
	attempts: number;
	/** practice time, each attempt capped (see the repository) */
	seconds: number;
};

export type UserActivity = {
	from: string;
	/** last day of the range */
	to: string;
	/** the UTC day streaks are counted up to */
	today: string;
	days: { date: string; attempts: number; minutes: number }[];
	currentStreak: number;
	longestStreak: number;
	activeDays: number;
	totalAttempts: number;
};

const dayMs = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of the UTC day containing `date`. */
export function utcDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** UTC days, YYYY-MM-DD, both included. */
export type ActivityRange = { from: string; to: string };

/** True for a real calendar day written YYYY-MM-DD (not 2026-02-30). */
export function isDayKey(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const ms = Date.parse(`${value}T00:00:00Z`);
	return !Number.isNaN(ms) && utcDayKey(new Date(ms)) === value;
}

/** Number of days in the range, both ends included. */
export function rangeLength(range: ActivityRange): number {
	return dayNumber(range.to) - dayNumber(range.from) + 1;
}

/** The `days` UTC days ending today (inclusive). */
export function lastDays(now: Date, days: number): ActivityRange {
	const to = utcDayKey(now);
	return { from: utcDayKey(new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * dayMs)), to: to };
}

function dayNumber(key: string): number {
	return Math.floor(Date.parse(`${key}T00:00:00Z`) / dayMs);
}

/**
 * Streaks over UTC days (the same day boundary the achievement service uses for login streaks).
 * The current streak survives until the end of the day after the last active day, so a learner
 * who practised yesterday but not yet today still sees it.
 */
export function computeStreaks(
	activeDayKeys: string[],
	today: string,
): { current: number; longest: number } {
	const days = [...new Set(activeDayKeys.map(dayNumber))].sort((a, b) => a - b);
	if (days.length === 0) return { current: 0, longest: 0 };

	let longest = 1;
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = days[i] - days[i - 1] === 1 ? run + 1 : 1;
		longest = Math.max(longest, run);
	}
	const sinceLast = dayNumber(today) - days[days.length - 1];
	return { current: sinceLast <= 1 ? run : 0, longest: longest };
}

/**
 * The activity view for a range of UTC days: the days in the range, plus all-time totals and
 * streaks counted up to today (whatever the range).
 */
export function buildUserActivity(
	rows: ActivityDayRow[],
	now: Date,
	range: ActivityRange,
): UserActivity {
	const { from, to } = range;
	const today = utcDayKey(now);
	const active = rows.filter(r => r.attempts > 0);
	const streaks = computeStreaks(
		active.map(r => r.date),
		today,
	);
	return {
		from: from,
		to: to,
		today: today,
		days: active
			.filter(r => r.date >= from && r.date <= to)
			.sort((a, b) => a.date.localeCompare(b.date))
			.map(r => ({ date: r.date, attempts: r.attempts, minutes: Math.round(r.seconds / 60) })),
		currentStreak: streaks.current,
		longestStreak: streaks.longest,
		activeDays: active.length,
		totalAttempts: active.reduce((sum, r) => sum + r.attempts, 0),
	};
}
