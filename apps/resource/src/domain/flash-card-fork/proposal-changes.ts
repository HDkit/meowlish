import { CARD_DIFF_FIELDS, cardContentSchema } from './card-content';
import { type ListChanges } from './list-diff';
import { z } from 'zod/v4';

const listChangesSchema = z.object({
	added: z.array(z.object({ sourceCardId: z.string(), card: cardContentSchema })),
	modified: z.array(
		z.object({
			targetCardId: z.string(),
			sourceCardId: z.string(),
			fields: z.array(z.enum(CARD_DIFF_FIELDS)),
			base: cardContentSchema,
			proposed: cardContentSchema,
		}),
	),
	removed: z.array(z.object({ targetCardId: z.string(), base: cardContentSchema })),
});

/** Reads a proposal's stored changes (JSON column); throws if the snapshot is malformed. */
export const parseListChanges = (json: unknown): ListChanges => listChangesSchema.parse(json);
