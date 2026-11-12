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
		if (this.total >= 7) this.addBadge(Badge.LoginSevenDays);
		if (this.total >= 30) this.addBadge(Badge.LoginOneMonth);
		if (this.total >= 365) this.addBadge(Badge.LoginOneYear);
		const currentStreak = loginStreakDays(this.startedAt, this.lastLogin);
		if (currentStreak >= this.longestStreak) {
			this.longestStreak = currentStreak;
			if (this.longestStreak >= 7) this.addBadge(Badge.LoginSevenDaysStreak);
			if (this.longestStreak >= 30) this.addBadge(Badge.LoginOneMonthStreak);
			if (this.longestStreak >= 365) this.addBadge(Badge.LoginOneYearStreak);
		}
	}

	private addBadge(badge: Badge) {
		if (!this.badges.has(badge)) {
			this.badges.add(badge);
			this.apply(new BadgeAddedEvent({ uid: this.id, badge: badge }));
		}
	}
}

/** Length in UTC calendar days of the streak running from `startedAt` to `lastLogin`, both included. */
export const loginStreakDays = (startedAt: Date, lastLogin: Date): number =>
	utcCalendarDaysBetween(lastLogin, startedAt) + 1;
