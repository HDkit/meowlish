import { isAttemptVersionConflict } from '../../domain/repositories/attempt.repository';
import { jitter, retryOnConflict } from '@server/messaging';

// Autosave sends several answers to one attempt at once, and each save bumps the attempt's
// version, so concurrent saves conflict routinely: retry enough that they all land.
export const MAX_ATTEMPT_SAVE_TRIES = 6;

/**
 * Runs `work` (load attempt → change → versioned save) again when a concurrent save bumped the
 * attempt's version first. `work` must be `@Transactional()` so each try reloads in a fresh
 * transaction; a conflicted try rolled back, so re-applying it is safe.
 */
export function retryAttemptConflicts<T>(work: () => Promise<T>): Promise<T> {
	return retryOnConflict(work, {
		attempts: MAX_ATTEMPT_SAVE_TRIES,
		isConflict: isAttemptVersionConflict,
		delayMs: jitter(10, 60),
	});
}
