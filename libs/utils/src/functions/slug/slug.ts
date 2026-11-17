/** Longest slug kept (before a `-2` style suffix). */
export const MAX_SLUG_LENGTH = 80;

/**
 * URL slug of a title: lower case ASCII letters, digits and hyphens. Vietnamese (and other)
 * accents are dropped and `đ` becomes `d`, so "Làm thế nào để viết email" → "lam-the-nao-de-viet-email".
 * Returns '' when nothing usable is left (callers fall back to a default).
 */
export function slugify(text: string, maxLength = MAX_SLUG_LENGTH): string {
	const ascii = text
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.replace(/[đĐ]/g, 'd')
		.toLowerCase();
	const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	if (slug.length <= maxLength) return slug;
	// cut at a word boundary when one is near the limit
	const cut = slug.slice(0, maxLength);
	const lastHyphen = cut.lastIndexOf('-');
	return (lastHyphen > maxLength * 0.6 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, '');
}

/**
 * First free slug for `title`: `base`, then `base-2`, `base-3`, … `taken` gets every existing slug
 * that starts with `base` (one query), so this needs no loop of lookups. A slug that only looks
 * like an id (`fallback` when the title has no usable characters) still works as a URL.
 */
export function nextFreeSlug(title: string, taken: Iterable<string>, fallback = 'item'): string {
	const base = slugify(title) || fallback;
	const used = new Set(taken);
	if (!used.has(base)) return base;
	for (let n = 2; ; n++) {
		const candidate = `${base}-${n}`;
		if (!used.has(candidate)) return candidate;
	}
}
