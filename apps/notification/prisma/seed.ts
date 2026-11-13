import { PrismaClient } from '@prisma-client/notification';

const prisma = new PrismaClient();

/**
 * Notifications are produced only by real events (badge earned, report created for admins, report
 * status changed for the reporter), so the seed creates none: invented ones ("Tuần này bạn đã học
 * được 5 bài mới", a "first lesson" badge that doesn't exist, ...) looked nothing like what the
 * system sends. Earlier seeds created such rows with ids `seed-<hash>`; remove them so a re-seed
 * also cleans existing databases. Users without saved preferences get every notification, so no
 * preference rows are needed either.
 */
async function main() {
	const { count } = await prisma.notification.deleteMany({
		where: { id: { startsWith: 'seed-' } },
	});
	console.warn(`Removed ${count} placeholder notifications from earlier seeds`);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
