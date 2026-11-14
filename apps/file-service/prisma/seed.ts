import { buildSeedRows } from './seed-data';
import { PrismaClient } from '@prisma-client/file';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
	const rootMediaDir = path.join(process.cwd(), 'eng-media');
	if (!fs.existsSync(rootMediaDir)) {
		throw new Error(
			`Directory not found: ${rootMediaDir}. Please put the files needed to sit in the folder eng-media at project root, or you can skip seeding the file service.`,
		);
	}
	const data = buildSeedRows(rootMediaDir);
	// Insert in batches (important for large folders)
	const batchSize = 500;
	for (let i = 0; i < data.length; i += batchSize) {
		const batch = data.slice(i, i + batchSize);
		await prisma.file.createMany({
			data: batch,
			skipDuplicates: true,
		});
		// createMany skips rows that already exist, so flag them explicitly (idempotent).
		await prisma.file.updateMany({
			where: { id: { in: batch.map(r => r.id) } },
			data: { isSystem: true },
		});
	}
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
