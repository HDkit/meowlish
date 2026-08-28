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

		// Seed flashcard list ownership
		const flashCardLists = await resourceDb.flashCardList.findMany({
			select: { id: true, authorId: true },
		});
		console.warn(`Found ${flashCardLists.length} flash card lists`);
		for (const list of flashCardLists) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'flashcard-list', resourceId: list.id } },
				update: { ownerId: list.authorId },
				create: { resourceType: 'flashcard-list', resourceId: list.id, ownerId: list.authorId },
			});
		}
		console.warn(`Seeded ${flashCardLists.length} flashcard list ownership records`);

		// Note: rooms don't currently track who created them in the DB,
		// so we can't seed room ownership from existing data.
		// New rooms will be tracked going forward.

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
