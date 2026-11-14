import { ExamId } from '../../../domain/entities/exam.entity';
import { Choice, Question } from '../../../domain/entities/question.entity';
import { ExamStatus } from '../../../enums/exam-status.enum';
import { QuestionType } from '../../../enums/question-type.enum';
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
	it('rejects a batch that ends with two correct choices on a single-choice question', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		question.updateChoice('c1', { isCorrect: true });
		expect(() => question.assertChoicesConsistent()).toThrow(ConflictException);
	});

	it('rejects adding a second correct choice in a batch', () => {
		const question = newQuestion(QuestionType.MultipleChoiceSingle);
		question.addChoice(new Choice({ key: 'k2', isCorrect: true }));
		expect(() => question.assertChoicesConsistent()).toThrow(ConflictException);
	});

	it('accepts moving the correct answer in either order within a batch', () => {
		const markFirst = newQuestion(QuestionType.MultipleChoiceSingle);
		markFirst.updateChoice('c1', { isCorrect: true });
		markFirst.updateChoice('c0', { isCorrect: false });
		expect(() => markFirst.assertChoicesConsistent()).not.toThrow();
		expect(markFirst.choices.map(c => c.isCorrect)).toEqual([false, true]);
	});

	it('allows several correct choices on a multi-choice question', () => {
		const question = newQuestion(QuestionType.MultipleChoiceMultiple);
		question.updateChoice('c1', { isCorrect: true });
		expect(() => question.assertChoicesConsistent()).not.toThrow();
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
