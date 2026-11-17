import { AttemptScoreBadgeManager } from '../../../domain/entities/attempt-score-badge-manager.entity';
import { Badge } from '../../../enums/badge.enum';

const manager = (good = 0, perfect = 0) =>
	new AttemptScoreBadgeManager({ id: 'u1', version: 1, good: good, perfect: perfect, badges: [] });

describe('AttemptScoreBadgeManager rescoring', () => {
	it('moves an attempt to the tier of its new score', () => {
		const m = manager(0, 0);
		m.updateProgress(7, 10); // submit: 70 %, no tier
		m.rescore(7, 9, 10); // AI writing feedback: 90 %, good
		expect({ good: m.good, perfect: m.perfect }).toEqual({ good: 1, perfect: 0 });
		expect(m.badges.has(Badge.FirstGoodScore)).toBe(true);

		m.rescore(9, 10, 10); // second essay scored: 100 %
		expect({ good: m.good, perfect: m.perfect }).toEqual({ good: 0, perfect: 1 });
		expect(m.badges.has(Badge.FirstPerfectScore)).toBe(true);
		// a badge already earned stays
		expect(m.badges.has(Badge.FirstGoodScore)).toBe(true);
	});

	it('gives the same counts whichever of scored and rescored arrives first', () => {
		const inOrder = manager(3, 0);
		inOrder.updateProgress(8, 10);
		inOrder.rescore(8, 10, 10);
		const reversed = manager(3, 0);
		reversed.rescore(8, 10, 10);
		reversed.updateProgress(8, 10);
		expect([reversed.good, reversed.perfect]).toEqual([inOrder.good, inOrder.perfect]);
		expect([inOrder.good, inOrder.perfect]).toEqual([3, 1]);
	});

	it('ignores a change within the same tier', () => {
		const m = manager(2, 0);
		m.rescore(8, 9, 10);
		expect(m.good).toBe(2);
	});
});
