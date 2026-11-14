import { SEED_USERS } from './attempt-plans';
import { PrismaClient } from '@prisma-client/exam';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The demo account's exam goal (one goal per user, keyed by user id). Created only when missing,
 * so a goal a tester set on the shared account survives a re-seed.
 */
export async function seedGoals(prisma: PrismaClient): Promise<void> {
	const existing = await prisma.goal.findUnique({ where: { uid: SEED_USERS.demo } });
	if (existing) return;
	const examDay = new Date(Math.floor((Date.now() + 75 * DAY) / DAY) * DAY);
	await prisma.goal.create({
		data: { uid: SEED_USERS.demo, type: 'IELTS', target: 7, date: examDay },
	});
	console.warn('Seeded the demo account goal');
}
