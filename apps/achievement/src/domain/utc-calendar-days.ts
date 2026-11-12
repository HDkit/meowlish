const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days since the epoch of the instant's UTC calendar date (its `YYYY-MM-DD` in UTC). */
const utcDayNumber = (date: Date): number => Math.floor(date.getTime() / MS_PER_DAY);

/**
 * Calendar days from `earlier` to `later`, counted on UTC dates whatever the server's time zone:
 * 23:59Z and 00:01Z the next day are 1 apart, 00:01Z and 23:59Z the same day are 0 apart.
 */
export function utcCalendarDaysBetween(later: Date, earlier: Date): number {
	return utcDayNumber(later) - utcDayNumber(earlier);
}
