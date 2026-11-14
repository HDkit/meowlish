import {
	AttemptEvaluator,
	AttemptQuestion,
	AttemptResponseResult,
} from '../../../domain/entities/attempt-evaluator.entity';
import { Attempt } from '../../../domain/entities/attempt.entity';
import { AttemptVersionConflictException } from '../../../domain/repositories/attempt.repository';
import { QuestionType } from '../../../enums/question-type.enum';
import { AttemptPrismaRepositoryImpl } from '../../../infra/repositories/attempt.prisma.repository.impl';

jest.mock('@prisma-client/exam', () => ({
	Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

const setup = (updatedRows = 1) => {
	const tx = {
		attempt: {
			updateMany: jest.fn().mockResolvedValue({ count: updatedRows }),
			findUnique: jest.fn(),
		},
		attemptResponse: { update: jest.fn().mockResolvedValue({}), create: jest.fn() },
		question: { findMany: jest.fn() },
		scorerData: {
			upsert: jest.fn().mockResolvedValue({ response: { attemptId: 'a1' } }),
		},
	};
	const txHost = { tx: tx, withTransaction: (fn: () => Promise<void>) => fn() };
	return { tx: tx, repo: new AttemptPrismaRepositoryImpl(txHost as never) };
};

const attemptAt = (version: number) =>
	new Attempt({
		id: 'a1',
		version: version,
		attemptedBy: 'u1',
		examId: 'e1',
		startedAt: new Date(),
		durationLimit: 60,
	});

describe('AttemptPrismaRepositoryImpl optimistic locking (C4)', () => {
	it('saves an attempt conditionally on the loaded version and bumps it', async () => {
		const { tx, repo } = setup();
		await repo.save(attemptAt(4));
		const [args] = tx.attempt.updateMany.mock.calls[0] as [
			{ where: unknown; data: { version: unknown } },
		];
		expect(args.where).toEqual({ id: 'a1', version: 4 });
		expect(args.data.version).toEqual({ increment: 1 });
	});

	it('throws a version conflict when the row moved on (0 rows updated)', async () => {
		const { tx, repo } = setup(0);
		await expect(repo.save(attemptAt(4))).rejects.toBeInstanceOf(AttemptVersionConflictException);
		expect(tx.attemptResponse.create).not.toHaveBeenCalled();
	});

	it('saves a score conditionally on the version too', async () => {
		const { tx, repo } = setup(0);
		const evaluator = new AttemptEvaluator({ id: 'a1', version: 2, questions: [], responses: [] });
		await expect(repo.save(evaluator)).rejects.toBeInstanceOf(AttemptVersionConflictException);
		expect(tx.attempt.updateMany).toHaveBeenCalledWith({
			where: { id: 'a1', version: 2 },
			data: { score: 0, totalPoints: 0, version: { increment: 1 } },
		});
	});
});

describe('AttemptPrismaRepositoryImpl writing feedback (C9)', () => {
	it('saveComment returns the attempt the response belongs to', async () => {
		const { repo } = setup();
		await expect(repo.saveComment('r1', '{}')).resolves.toBe('a1');
	});

	it('loads the stored AI band into the score evaluator', async () => {
		const { tx, repo } = setup();
		tx.attempt.findUnique.mockResolvedValue({
			id: 'a1',
			examId: 'e1',
			version: 3,
			attemptSections: [],
			attemptResponses: [
				{
					id: 'r1',
					questionId: 'q1',
					answers: ['essay'],
					isCorrect: null,
					// stored as the JSON-encoded WritingScoreDataDto
					scorerDatas: [{ comment: JSON.stringify({ overall_score: 6 }) }],
				},
				{ id: 'r2', questionId: 'q2', answers: ['essay'], isCorrect: null, scorerDatas: [] },
			],
		});
		tx.question.findMany.mockResolvedValue([
			{ id: 'q1', type: QuestionType.Writing, choices: [], points: 9 },
			{ id: 'q2', type: QuestionType.Writing, choices: [], points: 9 },
		]);
		const evaluator = await repo.getScoreEvaluator('a1');
		expect(evaluator?.version).toBe(3);
		expect(evaluator?.responses.get('q1')).toEqual(
			new AttemptResponseResult('r1', 'q1', ['essay'], null, 6),
		);
		expect(evaluator?.responses.get('q2')?.writingBand).toBeNull();
		expect(evaluator?.questions).toEqual([
			new AttemptQuestion('q1', QuestionType.Writing, [], 9),
			new AttemptQuestion('q2', QuestionType.Writing, [], 9),
		]);
	});
});
