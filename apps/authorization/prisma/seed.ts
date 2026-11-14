import { PrismaClient as AuthorizationPrismaClient } from '@prisma-client/authorization';
import { PrismaClient as ExamPrismaClient } from '@prisma-client/exam';
import { PrismaClient as LivePrismaClient } from '@prisma-client/live';
import { PrismaClient as ResourcePrismaClient } from '@prisma-client/resource';

async function seed() {
	const authorizationDb = new AuthorizationPrismaClient();
	const examDb = new ExamPrismaClient({
		datasourceUrl:
			process.env.EXAM_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/exam_db?schema=public`,
	});
	const resourceDb = new ResourcePrismaClient({
		datasourceUrl:
			process.env.RESOURCE_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/resource_db?schema=public`,
	});
	const liveDb = new LivePrismaClient({
		datasourceUrl:
			process.env.LIVE_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/live_db?schema=public`,
	});

	try {
		console.warn('Seeding ownership data from existing databases...');

		// Seed exam ownership
		const exams = await examDb.exam.findMany({ select: { id: true, createdBy: true } });
		console.warn(`Found ${exams.length} exams`);
		for (const exam of exams) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'exam', resourceId: exam.id } },
				update: { ownerId: exam.createdBy },
				create: { resourceType: 'exam', resourceId: exam.id, ownerId: exam.createdBy },
			});
		}
		console.warn(`Seeded ${exams.length} exam ownership records`);

		// Seed blog ownership
		const blogs = await resourceDb.blog.findMany({ select: { id: true, authorId: true } });
		console.warn(`Found ${blogs.length} blogs`);
		for (const blog of blogs) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'blog', resourceId: blog.id } },
				update: { ownerId: blog.authorId },
				create: { resourceType: 'blog', resourceId: blog.id, ownerId: blog.authorId },
			});
		}
		console.warn(`Seeded ${blogs.length} blog ownership records`);

		// Seed flashcard ownership
		const flashCards = await resourceDb.flashCard.findMany({
			select: { id: true, authorId: true },
		});
		console.warn(`Found ${flashCards.length} flash cards`);
		for (const card of flashCards) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'flashcard', resourceId: card.id } },
				update: { ownerId: card.authorId },
				create: { resourceType: 'flashcard', resourceId: card.id, ownerId: card.authorId },
			});
		}
		console.warn(`Seeded ${flashCards.length} flashcard ownership records`);

		// No route checks `flashcard-list` ownership (resource enforces it from its own rows) and no
		// event keeps these rows current, so drop the ones earlier seeds wrote.
		const { count: staleLists } = await authorizationDb.resourceOwnership.deleteMany({
			where: { resourceType: 'flashcard-list' },
		});
		console.warn(`Removed ${staleLists} stale flashcard list ownership records`);

		// Backfill live rooms' createdBy from ownership rows registered via live.room.created.
		// Idempotent: only rooms with no recorded owner are touched.
		const unownedRooms = await liveDb.room.findMany({
			where: { createdBy: null },
			select: { id: true },
		});
		const roomOwnerships = await authorizationDb.resourceOwnership.findMany({
			where: { resourceType: 'room', resourceId: { in: unownedRooms.map(r => r.id) } },
			select: { resourceId: true, ownerId: true },
		});
		for (const ownership of roomOwnerships) {
			await liveDb.room.update({
				where: { id: ownership.resourceId },
				data: { createdBy: ownership.ownerId },
			});
		}
		console.warn(
			`Backfilled createdBy on ${roomOwnerships.length}/${unownedRooms.length} rooms without an owner`,
		);

		// Seed room ownership from live's createdBy (now also filled in from the step above), for
		// rooms whose live.room.created event was lost or predates the consumer.
		const ownedRooms = await liveDb.room.findMany({
			where: { createdBy: { not: null } },
			select: { id: true, createdBy: true },
		});
		let seededRooms = 0;
		for (const room of ownedRooms) {
			if (!room.createdBy) continue;
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'room', resourceId: room.id } },
				update: { ownerId: room.createdBy },
				create: { resourceType: 'room', resourceId: room.id, ownerId: room.createdBy },
			});
			seededRooms++;
		}
		console.warn(`Seeded ${seededRooms} room ownership records`);

		const totalCount = await authorizationDb.resourceOwnership.count();
		console.warn(`\nSeeding complete. Total ownership records: ${totalCount}`);
	} finally {
		await authorizationDb.$disconnect();
		await examDb.$disconnect();
		await resourceDb.$disconnect();
		await liveDb.$disconnect();
	}
}

seed().catch(e => {
	console.error(e);
	process.exit(1);
});
