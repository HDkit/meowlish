import {
	AttemptEvaluator,
	AttemptQuestion,
	AttemptResponseResult,
} from '../../../domain/entities/attempt-evaluator.entity';
import { AttemptScoredEvent } from '../../../domain/events/attempt.event';
import { WritingSubmittedEvent } from '../../../domain/events/writing-submitted';
import { QuestionType } from '../../../enums/question-type.enum';

const evaluator = (writingBand: number | null) =>
	new AttemptEvaluator({
		id: 'a1',
		questions: [
			new AttemptQuestion('mcq', QuestionType.MultipleChoiceSingle, ['a'], 2),
			new AttemptQuestion('essay', QuestionType.Writing, [], 9),
		],
		responses: [
			new AttemptResponseResult('r-mcq', 'mcq', ['a']),
			new AttemptResponseResult('r-essay', 'essay', ['my essay'], null, writingBand),
		],
	});

describe('AttemptEvaluator writing points (C9)', () => {
	it('first scoring counts no writing points yet and requests AI scoring', () => {
		const attempt = evaluator(null);
		attempt.evaluateScore();
		expect(attempt.score).toBe(2);
		expect(attempt.totalPoints).toBe(11);
		const events = attempt.getUncommittedEvents();
		expect(events.filter(e => e instanceof WritingSubmittedEvent)).toHaveLength(1);
		expect(events.filter(e => e instanceof AttemptScoredEvent)).toHaveLength(1);
	});

	it('includes the writing points once AI feedback gave a band', () => {
		const attempt = evaluator(6);
		attempt.recomputeScore();
		// 2 (mcq) + 9 * 6/9 (essay)
		expect(attempt.score).toBe(8);
		expect(attempt.totalPoints).toBe(11);
	});

	it('rescoring raises no events (no second writing.submitted or attempt.scored)', () => {
		const attempt = evaluator(9);
		attempt.recomputeScore();
		expect(attempt.getUncommittedEvents()).toHaveLength(0);
		expect(attempt.score).toBe(11);
	});

	it('rescoring is idempotent', () => {
		const attempt = evaluator(4.5);
		attempt.recomputeScore();
		attempt.recomputeScore();
		// 2 + round(9 * 0.5)
		expect(attempt.score).toBe(7);
		expect(attempt.totalPoints).toBe(11);
	});

	it('clamps an out-of-range band to the question points', () => {
		const attempt = evaluator(12);
		attempt.recomputeScore();
		expect(attempt.score).toBe(11);
	});
});
