import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma-client/exam';

/**
 * Runs the insert of an exam/section/question → tag link. Tags are referenced by id, so an
 * unknown id violates the tag foreign key (P2003): report it as a missing tag, not a 500.
 */
export async function insertTagLink(insert: () => Promise<unknown>): Promise<void> {
	try {
		await insert();
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003')
			throw new NotFoundException('Tag not found');
		throw e;
	}
}
