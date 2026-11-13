import { PrismaClient } from '@prisma-client/notification';

const prisma = new PrismaClient();

/**
 * Notifications are produced only by real events (badge earned, report created for admins, report
 * status changed for the reporter), so the seed creates none: invented ones ("Tuần này bạn đã học
 * được 5 bài mới", a "first lesson" badge that doesn't exist, ...) looked nothing like what the
 * system sends. Earlier seeds created such rows with ids `seed-<hash>`; remove them so a re-seed
 * also cleans existing databases. Users without saved preferences get every notification, so no
 * preference rows are needed either.
 *
 * The one exception is the shared demo account: it gets the "badge earned" notifications the
 * system would have sent for the badges the achievement seed gives it (same type, title, message
 * and data as `AchievementEarnedHandler`), with ids `seed-demo-badge-*`.
 */
const DAY = 24 * 60 * 60 * 1000;
const DEMO_UID = 'demo';
/** Display names of the demo badges seeded in apps/achievement/prisma/seed.ts, oldest first. */
const DEMO_BADGES = [
	{ id: 'first-complete-attempt', name: 'First Step Taken' },
	{ id: 'tenth-complete-attempt', name: 'Warming Up' },
	{ id: 'first-good-score', name: 'Nice One' },
	{ id: 'login-seven-days', name: 'Getting Into the Groove' },
	{ id: 'login-seven-days-streak', name: 'Regular' },
];

async function main() {
	const { count } = await prisma.notification.deleteMany({
		where: { id: { startsWith: 'seed-' }, NOT: { id: { startsWith: 'seed-demo-' } } },
	});
	console.warn(`Removed ${count} placeholder notifications from earlier seeds`);

	const today = Math.floor(Date.now() / DAY) * DAY;
	for (const [i, badge] of DEMO_BADGES.entries()) {
		const createdAt = new Date(today - (DEMO_BADGES.length - i) * 5 * DAY + 10 * 60 * 60 * 1000);
		const id = `seed-demo-badge-${badge.id}`;
		// the account already got this one for real
		const real = await prisma.notification.findFirst({
			where: {
				recipientId: DEMO_UID,
				type: 'achievement',
				id: { not: id },
				data: { path: ['badgeName'], equals: badge.name },
			},
		});
		if (real) continue;
		// create only: keeps whether a tester has read it
		await prisma.notification.upsert({
			where: { id: id },
			update: {},
			create: {
				id: id,
				recipientId: DEMO_UID,
				type: 'achievement',
				title: 'Đạt thành tích mới!',
				message: `Bạn vừa nhận huy hiệu "${badge.name}". Tiếp tục phát huy nhé!`,
				data: { badgeName: badge.name },
				// the older ones have been seen
				isRead: i < DEMO_BADGES.length - 2,
				readAt: i < DEMO_BADGES.length - 2 ? createdAt : null,
				createdAt: createdAt,
			},
		});
	}
	console.warn(`Seeded ${DEMO_BADGES.length} badge notifications for the demo account`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
