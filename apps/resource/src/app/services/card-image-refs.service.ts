import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/resource';

type FileIdOrNone = string | null | undefined;

interface DeletedCardRow {
	id: string;
	imageFileId: string | null;
}

/**
 * Keeps file-service's reference counts of card images in step with the cards: every card row
 * holding an `imageFileId` is one reference, so copies of a card (which share the id) each hold
 * their own. Call these inside the `@Transactional()` method that writes the cards, so the events
 * go out through the outbox exactly when the change commits.
 */
@Injectable()
export class CardImageRefsService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
	) {}

	/** Cards now hold these images: one `resource.file.added` per id (nulls skipped). */
	async added(fileIds: readonly FileIdOrNone[]): Promise<void> {
		// Sequential: the outbox rows share one interactive transaction.
		for (const fileId of fileIds) if (fileId) await this.events.fileAdded(fileId);
	}

	/** Cards no longer hold these images: one `resource.files.removed`, repeats counted. */
	async released(fileIds: readonly FileIdOrNone[]): Promise<void> {
		const counts = new Map<string, number>();
		for (const fileId of fileIds) if (fileId) counts.set(fileId, (counts.get(fileId) ?? 0) + 1);
		await this.events.filesRemoved([...counts].map(([id, count]) => ({ id: id, count: count })));
	}

	/** A card's image changed from `before` to `after` (either may be none). */
	async replaced(before: FileIdOrNone, after: FileIdOrNone): Promise<void> {
		if ((before ?? null) === (after ?? null)) return;
		await this.released([before]);
		await this.added([after]);
	}

	/**
	 * Deletes cards (all of `listId`'s when `ids` is undefined, else those of `ids`, limited to
	 * `listId` when given) and releases their images. `DELETE … RETURNING` reports only the rows
	 * this statement removed, so a card deleted concurrently is never released twice.
	 * Returns the ids of the deleted cards.
	 */
	async deleteCards(where: { ids?: readonly string[]; listId?: string }): Promise<string[]> {
		if (where.ids?.length === 0 || (where.ids === undefined && where.listId === undefined)) {
			return [];
		}
		const listId = where.listId ?? null;
		const rows =
			where.ids === undefined ?
				await this.txHost.tx.$queryRaw<DeletedCardRow[]>`
					DELETE FROM flash_cards WHERE list_id = ${listId}
					RETURNING id, image_file_id AS "imageFileId"`
			:	await this.txHost.tx.$queryRaw<DeletedCardRow[]>`
					DELETE FROM flash_cards
					WHERE id = ANY(${[...where.ids]}::text[]) AND (${listId}::text IS NULL OR list_id = ${listId})
					RETURNING id, image_file_id AS "imageFileId"`;
		await this.released(rows.map(r => r.imageFileId));
		return rows.map(r => r.id);
	}
}
