import { Attempt, AttemptResponse } from '../../../domain/entities/attempt.entity';
import { AttemptSubmittedEvent } from '../../../domain/events/attempt.event';
import { QuestionType } from '../../../enums/question-type.enum';
import { ConflictException, ForbiddenException } from '@nestjs/common';

const newAttempt = (startedAt = new Date()) =>
	new Attempt({
		attemptedBy: 'u1',
		examId: 'e1',
		startedAt: startedAt,
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

describe('Attempt flags and notes', () => {
	it('flags and notes questions of an open attempt', () => {
		const attempt = newAttempt();
		expect(attempt.toggleFlag('q1')).toBe(true);
		attempt.addNote('q1', 'check later');
		expect(attempt.responses[0]).toMatchObject({ isFlagged: true, note: 'check later' });
	});

	it('refuses them once the attempt is submitted', () => {
		const attempt = newAttempt();
		attempt.endAttempt();
		expect(() => attempt.toggleFlag('q1')).toThrow(ConflictException);
		expect(() => attempt.addNote('q1', 'late')).toThrow(ConflictException);
	});

	it('refuses them after the time limit', () => {
		const attempt = newAttempt(new Date(Date.now() - 2 * 3600 * 1000));
		expect(() => attempt.toggleFlag('q1')).toThrow(ForbiddenException);
		expect(() => attempt.addNote('q1', 'late')).toThrow(ForbiddenException);
	});

	it('refuses questions outside the attempt (no foreign-key error later)', () => {
		const attempt = newAttempt();
		expect(() => attempt.toggleFlag('unknown')).toThrow(ConflictException);
		expect(() => attempt.addNote('unknown', 'x')).toThrow(ConflictException);
		expect(attempt.getUncommittedEvents()).toHaveLength(0);
	});
});
