import { Badge } from '../../enums/badge.enum';
import { BadgeAddedEvent } from '../events/badge.event';
import { utcCalendarDaysBetween } from '../utc-calendar-days';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate } from '@server/utils';

export class LoginBadgeManager
	extends AggregateRoot<Event<any>>
	implements IAggregate<LoginBadgeManager>
{
	public readonly id: string;
	public readonly version: number;
	public total: number;
	public longestStreak: number;
	public startedAt: Date;
	public lastLogin: Date;
	public badges: Set<Badge>;

	public constructor(constructorOptions: {
		id: string;
		version: number;
		total: number;
		longestStreak: number;
		startedAt: Date;
		lastLogin: Date;
		badges: Badge[];
	}) {
		super();
		this.id = constructorOptions.id;
		this.version = constructorOptions.version;
		this.total = constructorOptions.total;
		this.longestStreak = constructorOptions.longestStreak;
		this.startedAt = constructorOptions.startedAt;
		this.lastLogin = constructorOptions.lastLogin;
		this.badges = new Set(constructorOptions.badges);
	}

	/**
	 * Records a login. Days are UTC calendar dates: the first login is day 1, a login on the next
	 * UTC day extends the streak, another login the same UTC day changes nothing, and a missed
	 * day restarts the streak at 1. `total` counts distinct login days.
	 */
	updateProgress(loginTime: Date) {
		if (this.total === 0) {
			// First login. The row's dates are just its creation time; start from the login itself.
			this.total = 1;
			this.startedAt = loginTime;
			this.lastLogin = loginTime;
		} else {
			const diffDays = utcCalendarDaysBetween(loginTime, this.lastLogin);
			// A late, out-of-order event for an older login: that day is already accounted for.
			if (diffDays < 0) return;
			if (diffDays >= 1) this.total++;
			if (diffDays >= 2) this.startedAt = loginTime;
			this.lastLogin = loginTime;
		}
		this.longestStreak = Math.max(
			this.longestStreak,
			loginStreakDays(this.startedAt, this.lastLogin),
		);
		// Every threshold on every login (addBadge ignores badges already held), so a badge whose
		// target was reached earlier, e.g. before its threshold existed, is caught up on.
		for (const [days, badge] of LOGIN_DAY_BADGES) if (this.total >= days) this.addBadge(badge);
		for (const [days, badge] of LOGIN_STREAK_BADGES)
			if (this.longestStreak >= days) this.addBadge(badge);
	}

	private addBadge(badge: Badge) {
		if (!this.badges.has(badge)) {
			this.badges.add(badge);
			this.apply(new BadgeAddedEvent({ uid: this.id, badge: badge }));
		}
	}
}

/** Total login days → badge. The 14-day ones were missing, so nobody could ever earn them. */
const LOGIN_DAY_BADGES: [number, Badge][] = [
	[7, Badge.LoginSevenDays],
	[14, Badge.LoginTwoWeeks],
	[30, Badge.LoginOneMonth],
	[365, Badge.LoginOneYear],
];

/** Longest streak → badge. */
const LOGIN_STREAK_BADGES: [number, Badge][] = [
	[7, Badge.LoginSevenDaysStreak],
	[14, Badge.LoginTwoWeeksStreak],
	[30, Badge.LoginOneMonthStreak],
	[365, Badge.LoginOneYearStreak],
];

/** Length in UTC calendar days of the streak running from `startedAt` to `lastLogin`, both included. */
export const loginStreakDays = (startedAt: Date, lastLogin: Date): number =>
	utcCalendarDaysBetween(lastLogin, startedAt) + 1;

/**
 * The streak as it stands at `now`: still running while the last login was today or yesterday
 * (UTC calendar days, as in `updateProgress`), 0 once a whole UTC day has been missed.
 */
export const currentLoginStreakDays = (startedAt: Date, lastLogin: Date, now: Date): number =>
	utcCalendarDaysBetween(now, lastLogin) >= 2 ? 0 : loginStreakDays(startedAt, lastLogin);
