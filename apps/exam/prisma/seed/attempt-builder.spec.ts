import {
	AttemptEvaluator,
	AttemptQuestion,
	AttemptResponseResult,
} from '../../src/domain/entities/attempt-evaluator.entity';
import { QuestionType } from '../../src/enums/question-type.enum';
import {
	SEED_ATTEMPT_PREFIX,
	type SeedAttemptPlan,
	type SeedQuestion,
	buildPairAttempts,
	buildResponses,
	groupPlansByPair,
	orderPairPlans,
	seedAttemptId,
} from './attempt-builder';
import { SEED_ATTEMPT_PLANS } from './attempt-plans';

/** `duration` (seconds) of the seeded exams in exams.ts and its seeders. */
const EXAM_DURATIONS: Record<string, number> = {
	'1': 2 * 60 * 60,
	'2': 60 * 60,
	'3': 60 * 60,
	'4': 60 * 60,
	'5': 2 * 60 * 60,
	'6': 60 * 60,
	'7': 45 * 60,
};

const mcq = (id: string, correct: string): SeedQuestion => ({
	id: id,
	type: QuestionType.MultipleChoiceSingle,
	points: 1,
	choices: ['A', 'B', 'C', 'D'].map(k => ({ key: k, isCorrect: k === correct })),
});

const questions: SeedQuestion[] = [
	...Array.from({ length: 36 }, (_, i) => mcq(`mcq${i}`, 'ABCD'[i % 4])),
	{
		id: 'multi',
		type: QuestionType.MultipleChoiceMultiple,
		points: 2,
		choices: [
			{ key: 'A', isCorrect: true },
			{ key: 'B', isCorrect: false },
			{ key: 'C', isCorrect: true },
		],
	},
	{
		id: 'fill',
		type: QuestionType.FillExactInTheBlank,
		points: 1,
		choices: [{ key: 'TRUE', isCorrect: true }],
	},
	{
		id: 'fill-any',
		type: QuestionType.FillAnyInTheBlank,
		points: 1,
		choices: [
			{ key: 'BUS', isCorrect: true },
			{ key: 'COACH', isCorrect: true },
		],
	},
	{ id: 'essay', type: QuestionType.Writing, points: 9, choices: [] },
];

const plan = (overrides: Partial<SeedAttemptPlan> = {}): SeedAttemptPlan => ({
	key: 'test-1',
	userId: 'u1',
	examId: 'e1',
	daysAgo: 1,
	utcHour: 12,
	minutes: 30,
	accuracy: 0.7,
	skipRate: 0.1,
	...overrides,
});

const nows = ['2026-11-14T00:00:30Z', '2026-11-14T09:30:00Z', '2026-11-14T23:59:00Z'].map(
	s => new Date(s),
);

describe('seeded attempt plans', () => {
	const pairs = [...groupPlansByPair(SEED_ATTEMPT_PLANS).values()];

	it('have unique ids under the seed prefix', () => {
		const ids = SEED_ATTEMPT_PLANS.map(seedAttemptId);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.every(id => id.startsWith(SEED_ATTEMPT_PREFIX))).toBe(true);
	});

	it.each(nows)('keep at most one open attempt per (user, exam), in time, at %s', now => {
		for (const pairPlans of pairs) {
			const duration = EXAM_DURATIONS[pairPlans[0].examId];
			const ordered = orderPairPlans(pairPlans, duration, now);
			expect(ordered.filter(o => o.endedAt === null).length).toBeLessThanOrEqual(1);
			// the repository's rule: finished attempts are numbered 1..n, the open one n + 1
			expect(ordered.map(o => o.order)).toEqual(ordered.map((_, i) => i + 1));
			const open = ordered.find(o => o.endedAt === null);
			if (open) expect(open.order).toBe(ordered.length);
			for (const o of ordered) {
				expect(o.startedAt.getTime()).toBeLessThan(now.getTime());
				if (o.endedAt) expect(o.endedAt.getTime()).toBeLessThanOrEqual(now.getTime());
			}
		}
	});

	it('give the demo account 15 finished attempts, one open, practised up to today', () => {
		const now = new Date('2026-11-14T09:30:00Z');
		const demo = pairs.filter(p => p[0].userId === 'demo');
		const ordered = demo.flatMap(p => orderPairPlans(p, EXAM_DURATIONS[p[0].examId], now));
		expect(ordered.filter(o => o.endedAt === null)).toHaveLength(1);
		const ended = ordered.flatMap(o => (o.endedAt ? [o.endedAt.toISOString().slice(0, 10)] : []));
		expect(ended).toHaveLength(15);
		expect(ended).toEqual(
			expect.arrayContaining(['2026-11-14', '2026-11-13', '2026-11-12', '2026-11-11']),
		);
	});
});

describe('orderPairPlans', () => {
	const now = new Date('2026-11-14T12:00:00Z');

	it('rejects a second open attempt on the same exam', () => {
		expect(() =>
			orderPairPlans([plan({ key: 'a', open: true }), plan({ key: 'b', open: true })], 3600, now),
		).toThrow(/more than one open/);
	});

	it('rejects attempts that overlap', () => {
		expect(() =>
			orderPairPlans(
				[
					plan({ key: 'a', utcHour: 10, minutes: 30 }),
					plan({ key: 'b', utcHour: 10, minutes: 20 }),
				],
				3600,
				now,
			),
		).toThrow(/starts before/);
	});

	it('rejects an attempt longer than the time limit', () => {
		expect(() => orderPairPlans([plan({ minutes: 61 })], 3600, now)).toThrow(/time limit/);
	});

	it('numbers finished attempts by submit time and puts the open one last', () => {
		const ordered = orderPairPlans(
			[
				plan({ key: 'open', open: true, minutes: 5 }),
				plan({ key: 'late', daysAgo: 1 }),
				plan({ key: 'early', daysAgo: 3 }),
			],
			3600,
			now,
		);
		expect(ordered.map(o => [o.plan.key, o.order])).toEqual([
			['early', 1],
			['late', 2],
			['open', 3],
		]);
	});
});

describe('buildResponses', () => {
	it('scores the answers like AttemptEvaluator', () => {
		const p = plan({ writing: { essays: ['An essay.'], band: 6 } });
		const { responses, score, totalPoints } = buildResponses(p, questions);
		const evaluator = new AttemptEvaluator({
			id: seedAttemptId(p),
			questions: questions.map(
				q =>
					new AttemptQuestion(
						q.id,
						q.type,
						q.choices.filter(c => c.isCorrect).map(c => c.key),
						q.points,
					),
			),
			responses: responses.map(
				r =>
					new AttemptResponseResult(
						r.questionId,
						r.questionId,
						r.answers,
						null,
						r.writingFeedback ? 6 : null,
					),
			),
		});
		evaluator.recomputeScore();
		expect(score).toBe(evaluator.score);
		expect(totalPoints).toBe(evaluator.totalPoints);
		for (const r of responses) {
			if (r.writingFeedback) continue;
			expect(r.isCorrect).toBe(evaluator.responses.get(r.questionId)?.isCorrect);
		}
	});

	it('answers exactly round(accuracy * questions) objective questions right', () => {
		const objective = questions.filter(q => q.type !== QuestionType.Writing);
		const { responses } = buildResponses(plan({ accuracy: 0.85, skipRate: 0 }), questions);
		expect(responses.filter(r => r.isCorrect === true)).toHaveLength(
			Math.round(0.85 * objective.length),
		);
	});

	it('leaves an open attempt unscored and its writing without feedback', () => {
		const { responses } = buildResponses(
			plan({ open: true, writing: { essays: ['Draft.'], band: 6 } }),
			questions,
		);
		expect(responses.every(r => r.isCorrect === null)).toBe(true);
		expect(responses.some(r => r.writingFeedback)).toBe(false);
	});

	it('stores writing feedback the band reader understands', () => {
		const { responses } = buildResponses(
			plan({ writing: { essays: ['An essay.'], band: 6 } }),
			questions,
		);
		const essay = responses.find(r => r.questionId === 'essay');
		expect(JSON.parse(essay?.writingFeedback ?? '{}')).toMatchObject({ overall_score: 6 });
	});

	it('is deterministic', () => {
		expect(buildResponses(plan(), questions)).toEqual(buildResponses(plan(), questions));
	});
});

describe('buildPairAttempts', () => {
	it('leaves the open attempt without score and the finished ones scored', () => {
		const rows = buildPairAttempts(
			[plan({ key: 'done', daysAgo: 2 }), plan({ key: 'open', open: true, minutes: 5 })],
			{ duration: 3600, questions: questions },
			new Date('2026-11-14T12:00:00Z'),
		);
		expect(rows.map(r => [r.id, r.order, r.endedAt === null, r.score === null])).toEqual([
			[`${SEED_ATTEMPT_PREFIX}done`, 1, false, false],
			[`${SEED_ATTEMPT_PREFIX}open`, 2, true, true],
		]);
	});
});
