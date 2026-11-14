/**
 * Materialized paths for nested blog comments.
 *
 * Why a materialized path (and not a nested set, closure table or bare adjacency list):
 * - Comments are write-heavy: replies arrive all the time, edits/deletes are rare, and we only ever
 *   read whole threads. A nested set renumbers `lft`/`rgt` of every later node on each insert
 *   (O(n) writes and a hot lock on the post's rows); a closure table writes O(depth) extra rows per
 *   insert and needs a second table; an adjacency list alone needs a recursive CTE (raw SQL here).
 * - With a path, inserting a reply is one row plus an atomic `childSeq + 1` on its parent, and a
 *   page of threads is one indexed `root_id IN (...)` query; sorting by `path` gives the
 *   depth-first display order with siblings oldest first, so the tree is built in one pass.
 * - Trade-off: moving a subtree would rewrite its paths. Comments never move.
 *
 * Each level is one fixed-width base36 segment (the parent's child counter), so plain string
 * comparison of paths matches tree order. Top-level comments have the empty path.
 */
export const PATH_SEGMENT_WIDTH = 4;

/** 36^4 = 1,679,616 replies per comment. */
export const MAX_CHILDREN_PER_COMMENT = 36 ** PATH_SEGMENT_WIDTH;

/*
 * There is no depth limit. Each level adds PATH_SEGMENT_WIDTH characters to `path`; the only
 * ceiling is PostgreSQL's B-tree entry size on the (root_id, path) index (about 2,700 bytes, so
 * roughly 650 levels), far beyond any real thread.
 */

export const pathSegment = (seq: number): string => {
	if (!Number.isInteger(seq) || seq < 1 || seq >= MAX_CHILDREN_PER_COMMENT) {
		throw new RangeError(`Child sequence out of range: ${seq}`);
	}
	return seq.toString(36).padStart(PATH_SEGMENT_WIDTH, '0');
};

/** Path of the `seq`-th child (1-based) of a comment at `parentPath`. */
export const childPath = (parentPath: string, seq: number): string =>
	`${parentPath}${pathSegment(seq)}`;

export const depthOf = (path: string): number => path.length / PATH_SEGMENT_WIDTH;

/** Binary (not locale) comparison, so ordering never depends on a database or ICU collation. */
export const comparePaths = (a: string, b: string): number =>
	a < b ? -1
	: a > b ? 1
	: 0;
