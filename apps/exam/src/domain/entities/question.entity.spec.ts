import { ExamStatus } from '../../enums/exam-status.enum';
import { QuestionType } from '../../enums/question-type.enum';
import { ExamId } from './exam.entity';
import { Choice, Question } from './question.entity';
import { BadRequestException, ConflictException } from '@nestjs/common';

const newQuestion = (type: QuestionType, correct: boolean[] = [true, false]) =>
	new Question({
		id: 'q1',
		examId: new ExamId('e1', 1),
		examStatus: ExamStatus.Pending,
		sectionId: 's1',
		content: '',
		type: type,
		points: 1,
		explanation: '',
		choices: correct.map(
			(isCorrect, i) => new Choice({ id: `c${i}`, key: `k${i}`, isCorrect: isCorrect }),
		),
		tags: [],
		fileIds: [],
	});

describe('Question points (C14)', () => {
	it('accepts points = 0', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		question.updateDetails({ points: 0 });
		expect(question.points).toBe(0);
	});

	it.each([-1, 0.5])('rejects points = %p', points => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		expect(() => question.updateDetails({ points: points })).toThrow(BadRequestException);
	});
});

describe('Question single correct choice on updates (C14)', () => {
	it('rejects marking a second choice correct on a single-choice question', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		expect(() => question.updateChoice('c1', { isCorrect: true })).toThrow(ConflictException);
		expect(question.choices.filter(c => c.isCorrect)).toHaveLength(1);
	});

	it('allows moving the correct answer (unmark first, then mark)', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		question.updateChoice('c0', { isCorrect: false });
		question.updateChoice('c1', { isCorrect: true });
		expect(question.choices.map(c => c.isCorrect)).toEqual([false, true]);
	});

	it('allows re-marking the already-correct choice', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		expect(() => question.updateChoice('c0', { isCorrect: true })).not.toThrow();
	});

	it('allows several correct choices on a multi-choice question', () => {
		const question = newQuestion(QuestionType.MultipleChoiceMultiple);
		question.updateChoice('c1', { isCorrect: true });
		expect(question.choices.every(c => c.isCorrect)).toBe(true);
	});

	it('rejects a duplicate key on update', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		expect(() => question.updateChoice('c1', { key: 'k0' })).toThrow(ConflictException);
	});

	it('rejects switching a question with two correct choices to a single-choice type', () => {
		const question = newQuestion(QuestionType.MultipleChoiceMultiple, [true, true]);
		question.updateDetails({ type: QuestionType.MultipleChoiceSingle });
		expect(() => question.assertChoicesConsistent()).toThrow(ConflictException);
	});

	it('accepts that type switch when the extra correct choice is unmarked in the same batch', () => {
		const question = newQuestion(QuestionType.MultipleChoiceMultiple, [true, true]);
		question.updateDetails({ type: QuestionType.MultipleChoiceSingle });
		question.updateChoice('c1', { isCorrect: false });
		expect(() => question.assertChoicesConsistent()).not.toThrow();
	});
});
