import { BADGE_INFORMATION } from '../src/constants/badge-info.const';
import { Badge } from '../src/enums/badge.enum';
import { PrismaClient } from '@prisma-client/achievement';

const prisma = new PrismaClient();

async function seedBadges() {
	await prisma.badge.createMany({
		data: Object.values(Badge).map(b => ({
			name: b,
			...BADGE_INFORMATION[b],
		})),
		skipDuplicates: true,
	});
}

const DAY = 24 * 60 * 60 * 1000;
const DEMO_UID = 'demo';

/**
 * What the demo account's history (exam seed, apps/exam/prisma/seed/attempt-plans.ts) would have
 * earned through the attempt events: 15 finished attempts, 3 of them 80 %+ (the writing attempt
 * was 0 points when attempt.scored fired, its band came later), and a login record of 26 days
 * with a 12-day best run and a current streak running up to yesterday (UTC days).
 */
const DEMO_PROGRESS = {
	attempts: { total: 15, good: 3, perfect: 0 },
	login: { total: 26, longestStreak: 12, currentStreakDays: 5 },
	badges: [
		Badge.FirstCompleteAttempt,
		Badge.TenthCompleteAttempt,
		Badge.FirstGoodScore,
		Badge.LoginSevenDays,
		Badge.LoginSevenDaysStreak,
	],
};

/**
 * Re-runnable and additive: counters only ever go up to the seeded values (real events on the
 * shared account may have counted more), and the login dates are replaced only when the stored
 * last login is older than the seeded one.
 */
async function seedDemoProgress() {
	const { attempts, login, badges } = DEMO_PROGRESS;
	const criteria = await prisma.attemptCriteria.findUnique({ where: { uid: DEMO_UID } });
	await prisma.attemptCriteria.upsert({
		where: { uid: DEMO_UID },
		update: {
			total: Math.max(criteria?.total ?? 0, attempts.total),
			good: Math.max(criteria?.good ?? 0, attempts.good),
			perfect: Math.max(criteria?.perfect ?? 0, attempts.perfect),
			version: { increment: 1 },
		},
		create: { uid: DEMO_UID, ...attempts },
	});

	const today = Math.floor(Date.now() / DAY) * DAY;
	const lastLogin = new Date(today - DAY + 20 * 60 * 60 * 1000); // yesterday, 20:00 UTC
	const startedAt = new Date(today - login.currentStreakDays * DAY + 8 * 60 * 60 * 1000);
	const stored = await prisma.loginCriteria.findUnique({ where: { uid: DEMO_UID } });
	const replaceDates = !stored || stored.lastLogin < lastLogin;
	await prisma.loginCriteria.upsert({
		where: { uid: DEMO_UID },
		update: {
			total: Math.max(stored?.total ?? 0, login.total),
			longestStreak: Math.max(stored?.longestStreak ?? 0, login.longestStreak),
			...(replaceDates ? { startedAt: startedAt, lastLogin: lastLogin } : {}),
			version: { increment: 1 },
		},
		create: {
			uid: DEMO_UID,
			total: login.total,
			longestStreak: login.longestStreak,
			startedAt: startedAt,
			lastLogin: lastLogin,
		},
	});

	for (const [i, badge] of badges.entries()) {
		const owned = await prisma.userBadge.findFirst({ where: { uid: DEMO_UID, badgeName: badge } });
		if (owned) continue;
		await prisma.userBadge.create({
			data: {
				id: `seed-badge-${DEMO_UID}-${badge}`,
				uid: DEMO_UID,
				badgeName: badge,
				updatedAt: new Date(today - (badges.length - i) * 5 * DAY),
			},
		});
	}
	console.warn('Seeded the demo account achievements');
}

async function main() {
	await seedBadges();
	await seedDemoProgress();
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
