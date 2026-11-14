type Ordered = { order: number };

/**
 * Index where an item lands when placed at `idx` among `length` siblings.
 * Out-of-range indexes (below 0 or past the end) mean the tail.
 */
export function clampIndex(idx: number, length: number): number {
	return idx < 0 || idx > length ? length : idx;
}

/**
 * Order value for an item placed at `idx` of `items` (sorted by order, not containing the item),
 * so that it sorts between `items[idx - 1]` and `items[idx]`. Calls `rebalance` (which must re-space
 * `items` in place) when the two neighbours have no free order value between them.
 */
export function orderAt(
	items: readonly Ordered[],
	idx: number,
	range: number,
	rebalance: () => void,
): number {
	const prev = items.at(idx - 1);
	const next = items.at(idx);
	if (idx === 0 || !prev) return next ? next.order - range : 0;
	if (idx >= items.length || !next) return prev.order + range;
	if (next.order - prev.order <= 1) rebalance();
	return Math.floor((prev.order + next.order) / 2);
}
