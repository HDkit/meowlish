import { Badge } from '../../enums/badge.enum';
import { BadgeAddedEvent } from '../events/badge.event';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate } from '@server/utils';
import { differenceInCalendarDays } from 'date-fns';

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

	updateProgress(loginTime: Date) {
		// update recorded time
		const diffDays = differenceInCalendarDays(loginTime, this.lastLogin);
		// consecutive login
		if (diffDays >= 1) this.total++;
		// forgot to login
		if (diffDays >= 2) this.startedAt = loginTime;
		// update last login
		this.lastLogin = loginTime;
		if (this.total >= 7) this.addBadge(Badge.LoginSevenDays);
		if (this.total >= 30) this.addBadge(Badge.LoginOneMonth);
		if (this.total >= 365) this.addBadge(Badge.LoginOneYear);
		// update streak
		const currentStreak = differenceInCalendarDays(this.lastLogin, this.startedAt);
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
