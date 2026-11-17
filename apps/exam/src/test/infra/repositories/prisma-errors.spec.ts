import { AttemptConfig } from '../../../domain/entities/attempt-config.entity';
import { Exam, ExamId } from '../../../domain/entities/exam.entity';
import { ExamStatus } from '../../../enums/exam-status.enum';
import {
	AttemptPrismaRepositoryImpl,
	UnfinishedAttemptExistsException,
} from '../../../infra/repositories/attempt.prisma.repository.impl';
import { ExamPrismaRepositoryImpl } from '../../../infra/repositories/exam.prisma.repository.impl';
import { GoalPrismaRepositoryImpl } from '../../../infra/repositories/goal.prisma.repository.impl';
import {
	ExamVersionConflictException,
	translatePrismaErrors,
} from '../../../infra/repositories/prisma-errors';
import { TagPrismaRepositoryImpl } from '../../../infra/repositories/tag.prisma.repository.impl';
import { ConflictException, NotFoundException } from '@nestjs/common';

jest.mock('@prisma-client/exam', () => ({
	Prisma: {
		PrismaClientKnownRequestError: class extends Error {
			constructor(public code: string) {
				super(code);
			}
		},
	},
}));

const { Prisma } = jest.requireMock<{
	Prisma: { PrismaClientKnownRequestError: new (code: string) => Error };
}>('@prisma-client/exam');

const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(code);
const txHostOf = (tx: unknown) => ({
	tx: tx,
	withTransaction: <T>(fn: () => Promise<T>) => fn(),
});

describe('translatePrismaErrors', () => {
	it('maps a known code and rethrows everything else', async () => {
		const map = { P2002: () => new ConflictException('taken') };
		await expect(
			translatePrismaErrors(() => Promise.reject(prismaError('P2002')), map),
		).rejects.toBeInstanceOf(ConflictException);
		const other = prismaError('P2034');
		await expect(translatePrismaErrors(() => Promise.reject(other), map)).rejects.toBe(other);
		const plain = new Error('boom');
		await expect(translatePrismaErrors(() => Promise.reject(plain), map)).rejects.toBe(plain);
	});
});

describe('GoalPrismaRepositoryImpl status codes', () => {
	const setup = (error: Error) => {
		const goal = {
			create: jest.fn().mockRejectedValue(error),
			update: jest.fn().mockRejectedValue(error),
			delete: jest.fn().mockRejectedValue(error),
		};
		return new GoalPrismaRepositoryImpl(txHostOf({ goal: goal }) as never);
	};
	const goal = { uid: 'u1', date: new Date(), target: 7, type: 'IELTS' };

	it('a second goal is a 409', async () => {
		await expect(setup(prismaError('P2002')).setGoal(goal)).rejects.toBeInstanceOf(
			ConflictException,
		);
	});

	it('updating or deleting a missing goal is a 404', async () => {
		const repo = setup(prismaError('P2025'));
		await expect(repo.updateGoal(goal)).rejects.toBeInstanceOf(NotFoundException);
		await expect(repo.deleteGoal('u1')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('TagPrismaRepositoryImpl status codes', () => {
	const setup = () => {
		const tag = {
			create: jest.fn().mockRejectedValue(prismaError('P2002')),
			update: jest.fn(),
			findFirst: jest.fn().mockResolvedValue(null),
		};
		const tagTableLock = {
			findFirst: jest.fn().mockResolvedValue({ version: 1 }),
			update: jest.fn().mockResolvedValue({}),
		};
		const repo = new TagPrismaRepositoryImpl(
			txHostOf({ tag: tag, tagTableLock: tagTableLock }) as never,
		);
		return { tag: tag, repo: repo };
	};

	it('a duplicate name is a 409, on create and on rename', async () => {
		const { tag, repo } = setup();
		await expect(repo.addTag('IELTS')).rejects.toBeInstanceOf(ConflictException);
		tag.update.mockRejectedValue(prismaError('P2002'));
		await expect(repo.updateTag('t1', 'IELTS')).rejects.toBeInstanceOf(ConflictException);
	});

	it('renaming an unknown tag is a 404', async () => {
		const { tag, repo } = setup();
		tag.update.mockRejectedValue(prismaError('P2025'));
		await expect(repo.updateTag('nope', 'x')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('AttemptPrismaRepositoryImpl attempt start (#13)', () => {
	const setup = (insertedRows: number[]) => {
		const createMany = jest.fn();
		for (const count of insertedRows) createMany.mockResolvedValueOnce({ count: count });
		const tx = {
			attempt: {
				findFirst: jest
					.fn()
					.mockResolvedValueOnce({ order: 2 })
					.mockResolvedValueOnce({ order: 3 }),
				createMany: createMany,
			},
			attemptSection: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
		};
		return { tx: tx, repo: new AttemptPrismaRepositoryImpl(txHostOf(tx) as never) };
	};
	const config = () =>
		new AttemptConfig({
			attemptedBy: 'u1',
			examId: new ExamId('e1', 1),
			durationLimit: 60,
			isStrict: true,
			sectionIds: null,
		});

	it('creates the attempt after the last finished one, skipping duplicates', async () => {
		const { tx, repo } = setup([1]);
		await repo.save(config());
		const [args] = tx.attempt.createMany.mock.calls[0] as [
			{ data: { order: number }[]; skipDuplicates: boolean },
		];
		expect(args.data[0].order).toBe(3);
		expect(args.skipDuplicates).toBe(true);
	});

	it('an open attempt (or a concurrent start that won) is a clean 409', async () => {
		const { repo } = setup([0, 0]);
		const start = repo.save(config());
		await expect(start).rejects.toBeInstanceOf(UnfinishedAttemptExistsException);
		await expect(start).rejects.toBeInstanceOf(ConflictException);
	});

	it('retries once when the attempt holding the order was submitted meanwhile', async () => {
		const { tx, repo } = setup([0, 1]);
		await repo.save(config());
		const orders = tx.attempt.createMany.mock.calls.map(
			([args]: [{ data: { order: number }[] }]) => args.data[0].order,
		);
		expect(orders).toEqual([3, 4]);
	});
});

describe('exam optimistic lock', () => {
	it('a stale exam version is a 409, not a 502', async () => {
		const tx = { exam: { delete: jest.fn().mockRejectedValue(prismaError('P2025')) } };
		const repo = new ExamPrismaRepositoryImpl(txHostOf(tx) as never);
		const exam = new Exam({
			title: 't',
			duration: 600,
			createdBy: 'mod',
			status: ExamStatus.Pending,
			description: null,
			sections: [],
			tags: [],
		});
		await expect(repo.delete(exam)).rejects.toBeInstanceOf(ExamVersionConflictException);
	});
});
