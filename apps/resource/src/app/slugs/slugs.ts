import { nextFreeSlug, slugify } from '@server/utils';

/** Slug used when a title has no usable characters (`bai-viet`, `bai-viet-2`, …). */
export const BLOG_SLUG_FALLBACK = 'bai-viet';
export const FORUM_THREAD_SLUG_FALLBACK = 'chu-de';

/** Attempts at an insert whose slug another writer took in the meantime. */
export const SLUG_ATTEMPTS = 5;

/**
 * First free slug for `title`. `findTaken` returns the existing slugs that start with the base
 * slug (one `startsWith` query on the unique index), so `nextFreeSlug` can pick `base`, `base-2`, …
 */
export async function freeSlug(
	title: string,
	fallback: string,
	findTaken: (base: string) => Promise<(string | null)[]>,
): Promise<string> {
	const base = slugify(title) || fallback;
	const taken = await findTaken(base);
	return nextFreeSlug(
		title,
		taken.filter(s => s !== null),
		fallback,
	);
}

/**
 * A unique violation on a `slug` column (another row got the same slug first): Prisma's P2002
 * with `meta.target` naming the column. Checked by shape rather than `instanceof`, so this needs
 * no runtime import of the generated client.
 */
export function isSlugConflict(e: unknown): boolean {
	if (typeof e !== 'object' || e === null || !('code' in e) || e.code !== 'P2002') return false;
	const meta: unknown = 'meta' in e ? e.meta : undefined;
	const target: unknown =
		typeof meta === 'object' && meta !== null && 'target' in meta ? meta.target : undefined;
	if (Array.isArray(target)) return target.includes('slug');
	return typeof target === 'string' && target.includes('slug');
}

/**
 * Runs `attempt` again when it lost a slug race (P2002 on slug), up to `SLUG_ATTEMPTS` times.
 * `attempt` must be its own transaction: a unique violation aborts the PostgreSQL transaction it
 * happened in, so retrying inside it would fail with 25P02.
 */
export async function withSlugRetry<T>(attempt: () => Promise<T>): Promise<T> {
	for (let n = 1; ; n++) {
		try {
			return await attempt();
		} catch (e) {
			if (n >= SLUG_ATTEMPTS || !isSlugConflict(e)) throw e;
		}
	}
}
