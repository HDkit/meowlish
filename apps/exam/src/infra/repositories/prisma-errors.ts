import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma-client/exam';

/**
 * Runs a Prisma call and turns the expected request errors (by Prisma code, e.g. P2002 unique,
 * P2003 foreign key, P2025 record not found) into the Nest exception the client should see.
 * Anything else is rethrown untouched. Without this they reach clients as 502.
 */
export async function translatePrismaErrors<T>(
	run: () => Promise<T>,
	errors: Partial<Record<string, () => Error>>,
): Promise<T> {
	try {
		return await run();
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			const translate = errors[e.code];
			if (translate) throw translate();
		}
		throw e;
	}
}

/** The exam moved on to another `version` since it was loaded (optimistic lock). */
export class ExamVersionConflictException extends ConflictException {
	constructor() {
		super('The exam was modified concurrently, please reload and retry');
	}
}

/**
 * A write guarded by the exam's `version` (`where: { …, version }`) found no row: someone saved
 * the exam in between. Use only around the versioned write, where P2025 can mean nothing else.
 */
export function guardExamVersion<T>(run: () => Promise<T>): Promise<T> {
	return translatePrismaErrors(run, { P2025: () => new ExamVersionConflictException() });
}
