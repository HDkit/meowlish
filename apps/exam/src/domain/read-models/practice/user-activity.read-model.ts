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
	to: string;
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

/** Builds the activity view for the `rangeDays` UTC days ending today (inclusive). */
export function buildUserActivity(
	rows: ActivityDayRow[],
	now: Date,
	rangeDays: number,
): UserActivity {
	const to = utcDayKey(now);
	const from = utcDayKey(new Date(Date.parse(`${to}T00:00:00Z`) - (rangeDays - 1) * dayMs));
	const active = rows.filter(r => r.attempts > 0);
	const streaks = computeStreaks(
		active.map(r => r.date),
		to,
	);
	return {
		from: from,
		to: to,
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
