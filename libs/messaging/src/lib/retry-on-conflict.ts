export interface RetryOnConflictOptions {
	/** Total attempts, including the first one. */
	attempts: number;
	/** Whether the error is a retryable conflict (e.g. a stale optimistic-lock version). */
	isConflict: (error: unknown) => boolean;
}

/**
 * Runs `fn`, re-running it when it throws a conflict, up to `attempts` times in total. Other
 * errors, and the last conflict, are rethrown. `fn` must open a fresh transaction per call.
 */
export async function retryOnConflict<T>(
	fn: () => Promise<T>,
	options: RetryOnConflictOptions,
): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt >= options.attempts || !options.isConflict(error)) throw error;
		}
	}
}
