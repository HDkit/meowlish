import {
	BLOG_SLUG_FALLBACK,
	FORUM_THREAD_SLUG_FALLBACK,
	SLUG_ATTEMPTS,
	freeSlug,
	isSlugConflict,
} from './slugs';
import { PrismaClient } from '@prisma-client/resource';

/** Rows filled per query. */
export const SLUG_BACKFILL_BATCH = 200;

type SlugDb = Pick<PrismaClient, 'blog' | 'forumThread'>;

interface SlugTable {
	name: string;
	fallback: string;
	/** Rows without a slug, oldest first, minus the ones given up on. */
	pending(skip: string[]): Promise<{ id: string; title: string }[]>;
	taken(base: string): Promise<(string | null)[]>;
	/** Sets the slug only if the row still has none; returns how many rows changed (0 or 1). */
	setIfNull(id: string, slug: string): Promise<number>;
}

const tables = (db: SlugDb): SlugTable[] => [
	{
		name: 'blogs',
		fallback: BLOG_SLUG_FALLBACK,
		pending: skip =>
			db.blog.findMany({
				where: { slug: null, id: { notIn: skip } },
				orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				take: SLUG_BACKFILL_BATCH,
				select: { id: true, title: true },
			}),
		taken: async base =>
			(
				await db.blog.findMany({
					where: { slug: { startsWith: base } },
					select: { slug: true },
				})
			).map(r => r.slug),
		setIfNull: async (id, slug) =>
			(await db.blog.updateMany({ where: { id: id, slug: null }, data: { slug: slug } })).count,
	},
	{
		name: 'forum threads',
		fallback: FORUM_THREAD_SLUG_FALLBACK,
		pending: skip =>
			db.forumThread.findMany({
				where: { slug: null, id: { notIn: skip } },
				orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
				take: SLUG_BACKFILL_BATCH,
				select: { id: true, title: true },
			}),
		taken: async base =>
			(
				await db.forumThread.findMany({
					where: { slug: { startsWith: base } },
					select: { slug: true },
				})
			).map(r => r.slug),
		setIfNull: async (id, slug) =>
			(
				await db.forumThread.updateMany({
					where: { id: id, slug: null },
					data: { slug: slug },
				})
			).count,
	},
];

/** Gives one row a slug. False when every attempt lost a race for the slug. */
async function fillRow(table: SlugTable, row: { id: string; title: string }): Promise<boolean> {
	for (let n = 1; n <= SLUG_ATTEMPTS; n++) {
		const slug = await freeSlug(row.title, table.fallback, base => table.taken(base));
		try {
			// `slug: null` in the filter: a row another instance filled meanwhile is left alone.
			await table.setIfNull(row.id, slug);
			return true;
		} catch (e) {
			if (!isSlugConflict(e)) throw e;
		}
	}
	return false;
}

export interface SlugBackfillResult {
	filled: Record<string, number>;
	skipped: Record<string, number>;
}

/**
 * Gives every blog post and forum thread that has no slug one, oldest first (so the oldest row of
 * a title keeps the plain slug), with the same rule as on create. Idempotent: it only touches rows
 * whose slug is null. Safe to run on several instances at once: each update is its own statement
 * (no transaction to abort), a row filled elsewhere is skipped, and a slug taken elsewhere
 * (P2002) is recomputed; a row that keeps losing is left for the next run.
 */
export async function backfillSlugs(db: SlugDb): Promise<SlugBackfillResult> {
	const result: SlugBackfillResult = { filled: {}, skipped: {} };
	for (const table of tables(db)) {
		const skipped: string[] = [];
		let filled = 0;
		for (;;) {
			const rows = await table.pending(skipped);
			if (rows.length === 0) break;
			for (const row of rows) {
				if (await fillRow(table, row)) filled++;
				else skipped.push(row.id);
			}
		}
		result.filled[table.name] = filled;
		result.skipped[table.name] = skipped.length;
	}
	return result;
}
