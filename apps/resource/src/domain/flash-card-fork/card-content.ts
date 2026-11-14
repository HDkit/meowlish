import { z } from 'zod/v4';

/** The editable content of a flash card: what a copy duplicates and a proposal changes. */
export interface CardContent {
	word: string;
	definition: string;
	partOfSpeech: string | null;
	pronunciation: string | null;
	examples: string[];
	notes: string | null;
	tags: string[];
	image: string | null;
}

/** Fields a proposal compares and changes, field by field. */
export const CARD_DIFF_FIELDS = [
	'word',
	'definition',
	'partOfSpeech',
	'pronunciation',
	'examples',
	'notes',
	'tags',
] as const;

export type CardDiffField = (typeof CARD_DIFF_FIELDS)[number];

/** Fields pulling from the original brings over (the image too: it is copied, never proposed). */
export const CARD_SYNC_FIELDS = [...CARD_DIFF_FIELDS, 'image'] as const;

export type CardSyncField = (typeof CARD_SYNC_FIELDS)[number];

export const cardContentSchema = z.object({
	word: z.string(),
	definition: z.string(),
	partOfSpeech: z.string().nullable(),
	pronunciation: z.string().nullable(),
	examples: z.array(z.string()),
	notes: z.string().nullable(),
	tags: z.array(z.string()),
	image: z.string().nullable(),
});

/** Reads a stored snapshot (JSON column); null when absent or not a card snapshot. */
export const parseCardContent = (json: unknown): CardContent | null => {
	const parsed = cardContentSchema.safeParse(json);
	return parsed.success ? parsed.data : null;
};

/** Empty text and a missing value are the same thing to the user (forms send ''). */
const sameValue = (a: string | string[] | null, b: string | string[] | null): boolean => {
	if (Array.isArray(a) || Array.isArray(b)) {
		const left = Array.isArray(a) ? a : [];
		const right = Array.isArray(b) ? b : [];
		return left.length === right.length && left.every((v, i) => v === right[i]);
	}
	return (a ?? '') === (b ?? '');
};

/** The fields (of `fields`) whose values differ between `a` and `b`. */
export const differingFields = <F extends CardSyncField>(
	a: CardContent,
	b: CardContent,
	fields: readonly F[],
): F[] => fields.filter(f => !sameValue(a[f], b[f]));

/** `target` with the given fields taken from `source`. */
export const withFields = (
	target: CardContent,
	source: CardContent,
	fields: readonly CardSyncField[],
): CardContent => {
	const out: CardContent = { ...target, examples: [...target.examples], tags: [...target.tags] };
	for (const field of fields) {
		switch (field) {
			case 'examples':
			case 'tags':
				out[field] = [...source[field]];
				break;
			case 'word':
			case 'definition':
				out[field] = source[field];
				break;
			default:
				out[field] = source[field];
		}
	}
	return out;
};
