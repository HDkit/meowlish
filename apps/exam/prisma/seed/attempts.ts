import {
	SEED_ATTEMPT_PREFIX,
	type SeedAttemptPlan,
	buildPairAttempts,
	groupPlansByPair,
	toQuestionType,
} from './attempt-builder';
import { SEED_ATTEMPT_PLANS } from './attempt-plans';
import { Prisma, PrismaClient } from '@prisma-client/exam';
import { randomUUID } from 'crypto';

/**
 * Ids of the attempts earlier versions of this seed created for `admin`: six attempts that were
 * all left open, three of them on the same exam, so admin could never start that exam again.
 */
const LEGACY_SEED_ATTEMPT_IDS = ['1', '2', '3', '4', '5', '6'];
const LEGACY_SEED_USER = 'admin';

const isSeedOwned = (id: string): boolean => id.startsWith(SEED_ATTEMPT_PREFIX);

/**
 * Removes what earlier runs left behind, touching only rows the seed owns:
 * - the legacy open attempts `1`..`6` of admin (a legacy attempt admin has since submitted is a
 *   real result now and is kept: it doesn't break the rule);
 * - `seed-attempt-*` rows, recreated below with fresh dates. A (user, exam) pair that also holds an
 *   attempt someone really made is left as it is: deleting the seeded rows under it would shift
 *   the `order` numbering the real attempt was given.
 */
async function removeStaleSeedAttempts(prisma: PrismaClient): Promise<void> {
	const legacy = await prisma.attempt.deleteMany({
		where: { id: { in: LEGACY_SEED_ATTEMPT_IDS }, attemptedBy: LEGACY_SEED_USER, endedAt: null },
	});
	if (legacy.count) console.warn(`Removed ${legacy.count} legacy open seed attempts of admin`);

	const seeded = await prisma.attempt.findMany({
		where: { id: { startsWith: SEED_ATTEMPT_PREFIX } },
		select: { id: true, examId: true, attemptedBy: true },
	});
	const pairs = new Map<string, { examId: string; attemptedBy: string; ids: string[] }>();
	for (const a of seeded) {
		const key = `${a.attemptedBy}|${a.examId}`;
		const pair = pairs.get(key) ?? { examId: a.examId, attemptedBy: a.attemptedBy, ids: [] };
		pair.ids.push(a.id);
		pairs.set(key, pair);
	}
	let removed = 0;
	for (const pair of pairs.values()) {
		const others = await prisma.attempt.count({
			where: {
				examId: pair.examId,
				attemptedBy: pair.attemptedBy,
				NOT: { id: { startsWith: SEED_ATTEMPT_PREFIX } },
			},
		});
		if (others) {
			console.warn(
				`Keeping seeded attempts of ${pair.attemptedBy} on exam ${pair.examId}: the pair also has ${others} real attempt(s)`,
			);
			continue;
		}
		const { count } = await prisma.attempt.deleteMany({ where: { id: { in: pair.ids } } });
		removed += count;
	}
	console.warn(`Removed ${removed} seeded attempts from earlier runs`);
}

async function loadExam(prisma: PrismaClient, examId: string) {
	const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { duration: true } });
	if (!exam) return null;
	const questions = await prisma.question.findMany({
		where: { section: { examId: examId } },
		orderBy: [{ section: { order: 'asc' } }, { order: 'asc' }],
		select: {
			id: true,
			type: true,
			points: true,
			choices: { select: { key: true, isCorrect: true } },
		},
	});
	return {
		duration: exam.duration,
		questions: questions.map(q => ({ ...q, type: toQuestionType(q.type) })),
	};
}

async function seedPair(
	prisma: PrismaClient,
	plans: SeedAttemptPlan[],
	now: Date,
): Promise<number> {
	const { userId, examId } = plans[0];
	const existing = await prisma.attempt.findMany({
		where: { examId: examId, attemptedBy: userId },
		select: { id: true },
	});
	if (existing.length) {
		// Real attempts (or seeded ones kept above): adding more could open a second attempt or
		// collide with their `order`, so this pair gets nothing new.
		if (existing.some(a => !isSeedOwned(a.id)))
			console.warn(
				`Skipping seeded attempts of ${userId} on exam ${examId}: it has attempts already`,
			);
		return 0;
	}
	const exam = await loadExam(prisma, examId);
	if (!exam) {
		console.warn(`Skipping seeded attempts of ${userId} on exam ${examId}: no such exam`);
		return 0;
	}

	const rows = buildPairAttempts(plans, exam, now);
	try {
		await prisma.$transaction(
			async tx => {
				for (const { responses, ...attempt } of rows) {
					await tx.attempt.create({ data: attempt });
					const withIds = responses.map(r => ({ ...r, id: randomUUID() }));
					await tx.attemptResponse.createMany({
						data: withIds.map(r => ({
							id: r.id,
							attemptId: attempt.id,
							questionId: r.questionId,
							answers: r.answers,
							isCorrect: r.isCorrect,
						})),
					});
					const feedback = withIds.flatMap(r =>
						r.writingFeedback ? [{ responseId: r.id, comment: r.writingFeedback }] : [],
					);
					if (feedback.length) await tx.scorerData.createMany({ data: feedback });
				}
			},
			{ timeout: 60_000 },
		);
	} catch (e) {
		// someone started this exam meanwhile: their attempt took the order number
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
			console.warn(`Skipping seeded attempts of ${userId} on exam ${examId}: attempted meanwhile`);
			return 0;
		}
		throw e;
	}
	return rows.length;
}

/**
 * Seeded practice history for admin and the shared demo account (see `attempt-plans.ts`).
 * Re-runnable: every run replaces the seed's own rows, with dates relative to now.
 */
export async function seedAttempts(prisma: PrismaClient): Promise<void> {
	await removeStaleSeedAttempts(prisma);
	const now = new Date();
	let created = 0;
	for (const plans of groupPlansByPair(SEED_ATTEMPT_PLANS).values()) {
		created += await seedPair(prisma, plans, now);
	}
	console.warn(`Seeded ${created} attempts`);
}
