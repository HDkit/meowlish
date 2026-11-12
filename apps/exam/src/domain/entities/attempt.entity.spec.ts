import { QuestionType } from '../../enums/question-type.enum';
import { AttemptSubmittedEvent } from '../events/attempt.event';
import { Attempt, AttemptResponse } from './attempt.entity';
import { ConflictException } from '@nestjs/common';

const newAttempt = () =>
	new Attempt({
		attemptedBy: 'u1',
		examId: 'e1',
		startedAt: new Date(),
		durationLimit: 3600,
		questions: [{ id: 'q1', type: QuestionType.MultipleChoiceSingle }],
		responses: [new AttemptResponse({ questionId: 'q1', answers: ['a'] })],
	});

describe('Attempt.endAttempt (C4)', () => {
	it('ends once; a second call is a no-op without a second event', () => {
		const attempt = newAttempt();
		expect(attempt.endAttempt()).toBe(true);
		const endedAt = attempt.endedAt;
		expect(attempt.endAttempt()).toBe(false);
		expect(attempt.endedAt).toBe(endedAt);
		expect(
			attempt.getUncommittedEvents().filter(e => e instanceof AttemptSubmittedEvent),
		).toHaveLength(1);
	});

	it('refuses answers once ended', () => {
		const attempt = newAttempt();
		attempt.endAttempt();
		expect(() => attempt.answer('q1', 'b')).toThrow(ConflictException);
		expect(() => attempt.deleteAnswer('q1')).toThrow(ConflictException);
	});
});
