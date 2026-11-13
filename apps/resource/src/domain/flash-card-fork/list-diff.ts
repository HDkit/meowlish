import {
	CARD_DIFF_FIELDS,
	CARD_SYNC_FIELDS,
	type CardContent,
	type CardDiffField,
	differingFields,
	withFields,
} from './card-content';

/** A card of a copy ("fork"), with its link to the original's card. */
export interface ForkCard {
	id: string;
	/** The original card it was copied from; null for cards created in the copy. */
	originCardId: string | null;
	/** The original card's content when last copied or synced (the merge base); null if unknown. */
	originSnapshot: CardContent | null;
	content: CardContent;
}

/** A card of the original list. */
export interface OriginalCard {
	id: string;
	createdAt: Date;
	content: CardContent;
}

export interface AddedCardChange {
	sourceCardId: string;
	card: CardContent;
}

export interface ModifiedCardChange {
	targetCardId: string;
	sourceCardId: string;
	fields: CardDiffField[];
	/** The original card's values when the diff was computed. */
	base: CardContent;
	proposed: CardContent;
}

export interface RemovedCardChange {
	targetCardId: string;
	base: CardContent;
}

export interface ListChanges {
	added: AddedCardChange[];
	modified: ModifiedCardChange[];
	removed: RemovedCardChange[];
}

export const isEmptyChanges = (changes: ListChanges): boolean =>
	changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0;

/** Original cards created after the copy was made (or last synced) are new upstream, not removed in the copy. */
const existedAtSync = (card: OriginalCard, syncedAt: Date | null): boolean =>
	syncedAt === null || card.createdAt.getTime() <= syncedAt.getTime();

/**
 * What the copy changed relative to its original, like `git diff original...fork`:
 * - added: cards created in the copy;
 * - modified: copied cards whose fields the copy changed (compared with the snapshot taken when
 *   they were copied, so the original's own later edits are not reported as the copy reverting
 *   them) and that now differ from the original;
 * - removed: original cards that existed when the copy was synced and are gone from it.
 * Copied cards whose original card was deleted are ignored (the original removed them).
 */
export const computeListDiff = (
	forkCards: readonly ForkCard[],
	originalCards: readonly OriginalCard[],
	syncedAt: Date | null,
): ListChanges => {
	const originals = new Map(originalCards.map(c => [c.id, c]));
	const referenced = new Set<string>();
	const changes: ListChanges = { added: [], modified: [], removed: [] };

	for (const card of forkCards) {
		if (!card.originCardId) {
			changes.added.push({ sourceCardId: card.id, card: card.content });
			continue;
		}
		referenced.add(card.originCardId);
		const original = originals.get(card.originCardId);
		if (!original) continue;

		const changedInFork =
			card.originSnapshot ?
				differingFields(card.content, card.originSnapshot, CARD_DIFF_FIELDS)
			:	CARD_DIFF_FIELDS;
		const fields = differingFields(card.content, original.content, changedInFork);
		if (fields.length > 0) {
			changes.modified.push({
				targetCardId: original.id,
				sourceCardId: card.id,
				fields: fields,
				base: original.content,
				proposed: card.content,
			});
		}
	}

	for (const original of originalCards) {
		if (referenced.has(original.id) || !existedAtSync(original, syncedAt)) continue;
		changes.removed.push({ targetCardId: original.id, base: original.content });
	}
	return changes;
};

export interface EvaluatedModifiedChange extends ModifiedCardChange {
	current: CardContent | null;
	conflict: boolean;
	targetMissing: boolean;
}

export interface EvaluatedRemovedChange extends RemovedCardChange {
	current: CardContent | null;
	conflict: boolean;
	targetMissing: boolean;
}

export interface EvaluatedChanges {
	added: AddedCardChange[];
	modified: EvaluatedModifiedChange[];
	removed: EvaluatedRemovedChange[];
}

/**
 * Compares a stored proposal with the original's cards now.
 * - A modification conflicts when the original changed one of its fields since the proposal (and
 *   not to the proposed value). One whose card was deleted is skipped (`targetMissing`).
 * - A removal conflicts when the card was edited since the proposal; one already deleted is a no-op.
 */
export const evaluateChanges = (
	changes: ListChanges,
	currentCards: ReadonlyMap<string, CardContent>,
): EvaluatedChanges => ({
	added: changes.added,
	modified: changes.modified.map(change => {
		const current = currentCards.get(change.targetCardId) ?? null;
		const conflict =
			current !== null &&
			differingFields(current, change.base, change.fields).some(
				field => differingFields(current, change.proposed, [field]).length > 0,
			);
		return { ...change, current: current, conflict: conflict, targetMissing: current === null };
	}),
	removed: changes.removed.map(change => {
		const current = currentCards.get(change.targetCardId) ?? null;
		const conflict =
			current !== null && differingFields(current, change.base, CARD_DIFF_FIELDS).length > 0;
		return { ...change, current: current, conflict: conflict, targetMissing: current === null };
	}),
});

/** Changes shown without comparing them to the original now (a diff preview). */
export const notEvaluated = (changes: ListChanges): EvaluatedChanges => ({
	added: changes.added,
	modified: changes.modified.map(c => ({
		...c,
		current: null,
		conflict: false,
		targetMissing: false,
	})),
	removed: changes.removed.map(c => ({
		...c,
		current: null,
		conflict: false,
		targetMissing: false,
	})),
});

export const countConflicts = (changes: EvaluatedChanges): number =>
	changes.modified.filter(c => c.conflict).length + changes.removed.filter(c => c.conflict).length;

export interface UpstreamSyncPlan {
	/**
	 * Copied cards to overwrite with the original's content; their snapshot becomes that content.
	 * `contentChanged` is false when only the snapshot moves (both sides already equal).
	 */
	update: { forkCardId: string; content: CardContent; contentChanged: boolean }[];
	/** Original cards created since the last sync, to copy in. */
	add: OriginalCard[];
	/** Unchanged copies of cards the original deleted. */
	remove: string[];
	/** Cards changed both in the copy and in the original (or of unknown base): left alone. */
	skipped: number;
}

/**
 * Pulling the original into the copy, like `git merge` without conflicts: take the original's
 * changes for cards the copy did not change, add the original's new cards, drop unchanged copies
 * of cards the original deleted, and skip cards both sides changed.
 */
export const planUpstreamSync = (
	forkCards: readonly ForkCard[],
	originalCards: readonly OriginalCard[],
	syncedAt: Date | null,
): UpstreamSyncPlan => {
	const originals = new Map(originalCards.map(c => [c.id, c]));
	const referenced = new Set<string>();
	const plan: UpstreamSyncPlan = { update: [], add: [], remove: [], skipped: 0 };

	for (const card of forkCards) {
		if (!card.originCardId) continue;
		referenced.add(card.originCardId);
		const original = originals.get(card.originCardId);
		const snapshot = card.originSnapshot;
		const changedInFork =
			snapshot ? differingFields(card.content, snapshot, CARD_SYNC_FIELDS).length > 0 : true;

		if (!original) {
			if (changedInFork) plan.skipped++;
			else plan.remove.push(card.id);
			continue;
		}
		const changedUpstream =
			snapshot ? differingFields(original.content, snapshot, CARD_SYNC_FIELDS).length > 0 : true;
		if (!changedUpstream) continue;
		const alreadyEqual =
			differingFields(card.content, original.content, CARD_SYNC_FIELDS).length === 0;
		if (alreadyEqual) {
			// Same content on both sides: only the snapshot moves (no visible change).
			plan.update.push({ forkCardId: card.id, content: original.content, contentChanged: false });
			continue;
		}
		if (changedInFork) {
			plan.skipped++;
			continue;
		}
		plan.update.push({
			forkCardId: card.id,
			content: withFields(card.content, original.content, CARD_SYNC_FIELDS),
			contentChanged: true,
		});
	}

	for (const original of originalCards) {
		if (referenced.has(original.id) || existedAtSync(original, syncedAt)) continue;
		plan.add.push(original);
	}
	return plan;
};
