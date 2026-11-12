import { ExamId } from '../../../../domain/entities/exam.entity';
import { Choice, Question } from '../../../../domain/entities/question.entity';
import { ExamStatus } from '../../../../enums/exam-status.enum';
import { QuestionType } from '../../../../enums/question-type.enum';
import {
	UpdateQuestionCommand,
	UpdateQuestionCommandPayload,
} from '../../staff/exam.update-question.command';
import { UpdateQuestionHandler } from './update-question.handler';
import { ConflictException } from '@nestjs/common';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

// A single-choice question whose correct answer is A.
const mcq = () =>
	new Question({
		id: 'q1',
		examId: new ExamId('e1', 1),
		examStatus: ExamStatus.Pending,
		sectionId: 's1',
		content: '',
		type: QuestionType.MultipleChoiceSingle,
		points: 1,
		explanation: '',
		choices: [
			new Choice({ id: 'A', key: 'a', isCorrect: true }),
			new Choice({ id: 'B', key: 'b', isCorrect: false }),
		],
		tags: [],
		fileIds: [],
	});

const setup = () => {
	const question = mcq();
	const repo = {
		findOne: jest.fn().mockResolvedValue(question),
		save: jest.fn().mockResolvedValue(undefined),
	};
	const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
	const handler = new UpdateQuestionHandler(repo, publisher as never);
	const run = (
		options: Omit<ConstructorParameters<typeof UpdateQuestionCommandPayload>[0], 'id'>,
	) =>
		handler.execute(
			new UpdateQuestionCommand(new UpdateQuestionCommandPayload({ id: 'q1', ...options })),
		);
	return { question: question, repo: repo, run: run };
};

const correctIds = (question: Question) => question.choices.filter(c => c.isCorrect).map(c => c.id);

describe('UpdateQuestionHandler single correct choice is checked per batch (C14)', () => {
	it('accepts updateChoices [{B: true}, {A: false}]', async () => {
		const { question, repo, run } = setup();
		await run({
			updateChoices: [
				{ id: 'B', isCorrect: true },
				{ id: 'A', isCorrect: false },
			],
		});
		expect(correctIds(question)).toEqual(['B']);
		expect(repo.save).toHaveBeenCalledTimes(1);
	});

	it('accepts addChoices [correct C] with updateChoices [{A: false}]', async () => {
		const { question, repo, run } = setup();
		await run({
			addChoices: [{ key: 'c', isCorrect: true }],
			updateChoices: [{ id: 'A', isCorrect: false }],
		});
		expect(question.choices.filter(c => c.isCorrect).map(c => c.key)).toEqual(['c']);
		expect(repo.save).toHaveBeenCalledTimes(1);
	});

	it('rejects a batch that ends with two correct choices, without saving', async () => {
		const { repo, run } = setup();
		await expect(run({ updateChoices: [{ id: 'B', isCorrect: true }] })).rejects.toBeInstanceOf(
			ConflictException,
		);
		await expect(run({ addChoices: [{ key: 'c', isCorrect: true }] })).rejects.toBeInstanceOf(
			ConflictException,
		);
		expect(repo.save).not.toHaveBeenCalled();
	});
});
