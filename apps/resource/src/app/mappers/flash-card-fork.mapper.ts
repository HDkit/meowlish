import { type CardContent, parseCardContent } from '../../domain/flash-card-fork/card-content';
import {
	type EvaluatedChanges,
	type ForkCard,
	type ListChanges,
	type OriginalCard,
} from '../../domain/flash-card-fork/list-diff';
import {
	type CardContentReadModel,
	type ListChangesReadModel,
} from '../../domain/read-models/flash-card-proposal.read-model';
import { FlashCard, Prisma } from '@prisma-client/resource';

export const toCardContent = (card: FlashCard): CardContent => ({
	word: card.word,
	definition: card.definition,
	partOfSpeech: card.partOfSpeech,
	pronunciation: card.pronunciation,
	examples: card.examples,
	notes: card.notes,
	tags: card.tags,
	image: card.image,
});

export const toForkCard = (card: FlashCard): ForkCard => ({
	id: card.id,
	originCardId: card.originCardId,
	originSnapshot: parseCardContent(card.originSnapshot),
	content: toCardContent(card),
});

export const toOriginalCard = (card: FlashCard): OriginalCard => ({
	id: card.id,
	createdAt: card.createdAt,
	content: toCardContent(card),
});

/** Card columns holding the content (for create/update). */
export const cardContentData = (content: CardContent) => ({
	word: content.word,
	definition: content.definition,
	partOfSpeech: content.partOfSpeech,
	pronunciation: content.pronunciation,
	examples: content.examples,
	notes: content.notes,
	tags: content.tags,
	image: content.image,
});

/** A content snapshot for a JSON column. */
export const toSnapshotJson = (content: CardContent): Prisma.InputJsonObject => ({
	...content,
});

export const toCardContentReadModel = (content: CardContent): CardContentReadModel => ({
	word: content.word,
	definition: content.definition,
	partOfSpeech: content.partOfSpeech ?? undefined,
	pronunciation: content.pronunciation ?? undefined,
	examples: content.examples,
	notes: content.notes ?? undefined,
	tags: content.tags,
	image: content.image ?? undefined,
});

/** Changes on the wire (evaluated against the original, or `notEvaluated` for a preview). */
export const toListChangesReadModel = (evaluated: EvaluatedChanges): ListChangesReadModel => {
	return {
		added: evaluated.added.map(c => ({
			sourceCardId: c.sourceCardId,
			card: toCardContentReadModel(c.card),
		})),
		modified: evaluated.modified.map(c => ({
			targetCardId: c.targetCardId,
			sourceCardId: c.sourceCardId,
			fields: c.fields,
			base: toCardContentReadModel(c.base),
			proposed: toCardContentReadModel(c.proposed),
			current: c.current ? toCardContentReadModel(c.current) : undefined,
			conflict: c.conflict,
			targetMissing: c.targetMissing,
		})),
		removed: evaluated.removed.map(c => ({
			targetCardId: c.targetCardId,
			base: toCardContentReadModel(c.base),
			current: c.current ? toCardContentReadModel(c.current) : undefined,
			conflict: c.conflict,
			targetMissing: c.targetMissing,
		})),
	};
};

/** Stored proposal changes (JSON column). */
export const toChangesJson = (changes: ListChanges): Prisma.InputJsonObject => ({
	added: changes.added.map(c => ({ sourceCardId: c.sourceCardId, card: { ...c.card } })),
	modified: changes.modified.map(c => ({
		targetCardId: c.targetCardId,
		sourceCardId: c.sourceCardId,
		fields: c.fields,
		base: { ...c.base },
		proposed: { ...c.proposed },
	})),
	removed: changes.removed.map(c => ({ targetCardId: c.targetCardId, base: { ...c.base } })),
});
