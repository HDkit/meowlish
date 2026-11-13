import { seedAttempts } from './seed/attempts';
import { seedExams } from './seed/exams';
import { seedGoals } from './seed/goals';
import { seedTags } from './seed/tags';
import { PrismaClient } from '@prisma-client/exam';

const prisma = new PrismaClient();

// seed order: tag -> exam -> section -> question -> choices
async function main() {
	await seedTags(prisma);
	await seedExams(prisma);
	await seedAttempts(prisma);
	await seedGoals(prisma);
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
