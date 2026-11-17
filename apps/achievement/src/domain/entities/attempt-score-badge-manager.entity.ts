import { Badge } from '../../enums/badge.enum';
import { BadgeAddedEvent } from '../events/badge.event';
import { AggregateRoot } from '@nestjs/cqrs';
import { Event, IAggregate } from '@server/utils';

export class AttemptScoreBadgeManager
	extends AggregateRoot<Event<any>>
	implements IAggregate<AttemptScoreBadgeManager>
{
	public readonly id: string;
	public readonly version: number;
	public perfect: number;
	public good: number;
	public badges: Set<Badge>;

	public constructor(constructorOptions: {
		id: string;
		version: number;
		perfect: number;
		good: number;
		badges: Badge[];
	}) {
		super();
		this.id = constructorOptions.id;
		this.version = constructorOptions.version;
		this.perfect = constructorOptions.perfect;
		this.good = constructorOptions.good;
		this.badges = new Set(constructorOptions.badges);
	}

	/** A scored attempt (`exam.attempt.scored`): counts it as good (>= 80 %) or perfect (100 %). */
	updateProgress(score: number, totalPoints: number) {
		this.count(tierOf(score, totalPoints), 1);
	}

	/**
	 * An attempt whose score changed later (`exam.attempt.rescored`, AI writing feedback): move it
	 * from the tier of its previous score to the tier of the new one. Expressed as a difference, so
	 * the result is right whichever of `scored` and `rescored` is processed first (a counter can be
	 * briefly negative in between). Badges are only ever added.
	 */
	rescore(previousScore: number, score: number, totalPoints: number) {
		const before = tierOf(previousScore, totalPoints);
		const after = tierOf(score, totalPoints);
		if (before === after) return;
		this.count(before, -1);
		this.count(after, 1);
	}

	private count(tier: ScoreTier, delta: number) {
		if (tier === 'good') {
			this.good += delta;
			if (this.good >= 1) this.addBadge(Badge.FirstGoodScore);
			if (this.good >= 10) this.addBadge(Badge.TenthGoodScore);
			if (this.good >= 100) this.addBadge(Badge.HundredthGoodScore);
		} else if (tier === 'perfect') {
			this.perfect += delta;
			if (this.perfect >= 1) this.addBadge(Badge.FirstPerfectScore);
			if (this.perfect >= 10) this.addBadge(Badge.TenthPerfectScore);
			if (this.perfect >= 100) this.addBadge(Badge.HundredthPerfectScore);
		}
	}

	private addBadge(badge: Badge) {
		if (!this.badges.has(badge)) {
			this.badges.add(badge);
			this.apply(new BadgeAddedEvent({ uid: this.id, badge: badge }));
		}
	}
}

type ScoreTier = 'none' | 'good' | 'perfect';

const tierOf = (score: number, totalPoints: number): ScoreTier => {
	const rank = totalPoints === 0 ? 0 : score / totalPoints;
	if (rank === 1) return 'perfect';
	if (rank >= 0.8 && rank < 1) return 'good';
	return 'none';
};
