import { PrismaClient as AuthorizationPrismaClient } from '../../../node_modules/.prisma/client/authorization/index.js';
import { PrismaClient as ExamPrismaClient } from '../../../node_modules/.prisma/client/exam/index.js';
import { PrismaClient as ResourcePrismaClient } from '../../../node_modules/.prisma/client/resource/index.js';
import { PrismaClient as LivePrismaClient } from '../../../node_modules/.prisma/client/live/index.js';

async function seed() {
	const authorizationDb = new AuthorizationPrismaClient();
	const examDb = new ExamPrismaClient({
		datasourceUrl: process.env.EXAM_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/exam_db?schema=public`,
	});
	const resourceDb = new ResourcePrismaClient({
		datasourceUrl: process.env.RESOURCE_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/resource_db?schema=public`,
	});
	const liveDb = new LivePrismaClient({
		datasourceUrl: process.env.LIVE_DB_URL ??
			`postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/live_db?schema=public`,
	});

	try {
		console.log('Seeding ownership data from existing databases...');

		// Seed exam ownership
		const exams = await examDb.exam.findMany({ select: { id: true, createdBy: true } });
		console.log(`Found ${exams.length} exams`);
		for (const exam of exams) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'exam', resourceId: exam.id } },
				update: { ownerId: exam.createdBy },
				create: { resourceType: 'exam', resourceId: exam.id, ownerId: exam.createdBy },
			});
		}
		console.log(`Seeded ${exams.length} exam ownership records`);

		// Seed blog ownership
		const blogs = await resourceDb.blog.findMany({ select: { id: true, authorId: true } });
		console.log(`Found ${blogs.length} blogs`);
		for (const blog of blogs) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'blog', resourceId: blog.id } },
				update: { ownerId: blog.authorId },
				create: { resourceType: 'blog', resourceId: blog.id, ownerId: blog.authorId },
			});
		}
		console.log(`Seeded ${blogs.length} blog ownership records`);

		// Seed flashcard ownership
		const flashCards = await resourceDb.flashCard.findMany({ select: { id: true, authorId: true } });
		console.log(`Found ${flashCards.length} flash cards`);
		for (const card of flashCards) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'flashcard', resourceId: card.id } },
				update: { ownerId: card.authorId },
				create: { resourceType: 'flashcard', resourceId: card.id, ownerId: card.authorId },
			});
		}
		console.log(`Seeded ${flashCards.length} flashcard ownership records`);

		// Seed flashcard list ownership
		const flashCardLists = await resourceDb.flashCardList.findMany({ select: { id: true, authorId: true } });
		console.log(`Found ${flashCardLists.length} flash card lists`);
		for (const list of flashCardLists) {
			await authorizationDb.resourceOwnership.upsert({
				where: { resourceType_resourceId: { resourceType: 'flashcard-list', resourceId: list.id } },
				update: { ownerId: list.authorId },
				create: { resourceType: 'flashcard-list', resourceId: list.id, ownerId: list.authorId },
			});
		}
		console.log(`Seeded ${flashCardLists.length} flashcard list ownership records`);

		// Note: rooms don't currently track who created them in the DB,
		// so we can't seed room ownership from existing data.
		// New rooms will be tracked going forward.

		const totalCount = await authorizationDb.resourceOwnership.count();
		console.log(`\nSeeding complete. Total ownership records: ${totalCount}`);
	} finally {
		await authorizationDb.$disconnect();
		await examDb.$disconnect();
		await resourceDb.$disconnect();
		await liveDb.$disconnect();
	}
}

seed().catch((e) => {
	console.error(e);
	process.exit(1);
});
