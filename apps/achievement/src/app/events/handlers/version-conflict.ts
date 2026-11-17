import type { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaClient } from '@prisma-client/achievement';
import { retryOnConflict } from '@server/messaging';

export const MAX_CONFLICT_ATTEMPTS = 3;

/** A stale `version` makes the repository's conditional `update` throw P2025 (record not found). */
export function isVersionConflict(error: unknown): boolean {
	// Duck-typed: importing the Prisma runtime for `instanceof` doesn't load under jest.
	return (
		error instanceof Error &&
		error.name === 'PrismaClientKnownRequestError' &&
		(error as { code?: unknown }).code === 'P2025'
	);
}

/**
 * Runs `work` in a fresh transaction per attempt (inbox claim included), retrying when a
 * concurrent handler bumped the badge manager's version first.
 */
export function inTransactionRetryingConflicts(
	txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
	work: () => Promise<void>,
): Promise<void> {
	return retryOnConflict(() => txHost.withTransaction(work), {
		attempts: MAX_CONFLICT_ATTEMPTS,
		isConflict: isVersionConflict,
	});
}
