import { copyName } from '../../domain/flash-card-fork/copy-name';
import {
	type ListChanges,
	computeListDiff,
	notEvaluated,
	planUpstreamSync,
} from '../../domain/flash-card-fork/list-diff';
import { type FlashCardListReadModel } from '../../domain/read-models/flash-card-list.read-model';
import {
	type FlashCardListDiffReadModel,
	type PullUpstreamResultReadModel,
} from '../../domain/read-models/flash-card-proposal.read-model';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	cardContentData,
	contentsOf,
	toCardContent,
	toForkCard,
	toListChangesReadModel,
	toOriginalCard,
	toSnapshotJson,
} from '../mappers/flash-card-fork.mapper';
import { toFlashCardListReadModel, visibleListsWhere } from '../mappers/flash-card.mapper';
import { type Requester } from '../types/requester';
import { CardImageRefsService } from './card-image-refs.service';
import { CardImageUrlService } from './card-image-url.service';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FlashCard, FlashCardList, PrismaClient } from '@prisma-client/resource';
import { FlashCardProposalStatus } from '@server/typing';
import { randomUUID } from 'node:crypto';

/** A copy and its original, with their cards. */
export interface ForkWithOriginal {
	fork: FlashCardList & { cards: FlashCard[] };
	original: FlashCardList & { cards: FlashCard[] };
}

/** Copies ("forks") of public lists: saving one, comparing it with its original, pulling updates. */
@Injectable()
export class FlashcardForkService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
		private readonly imageRefs: CardImageRefsService,
		private readonly imageUrls: CardImageUrlService,
	) {}

	/**
	 * Copy cards into `listId` for `authorId`, linked to their originals; returns the new ids.
	 * A copy shares its original's image file and holds a reference of its own, so deleting the
	 * original card doesn't free an image the copy still shows.
	 */
	private async copyCards(cards: FlashCard[], listId: string, authorId: string): Promise<string[]> {
		if (cards.length === 0) return [];
		const now = Date.now();
		const copies = cards.map((card, index) => {
			const content = toCardContent(card);
			return {
				id: randomUUID(),
				...cardContentData(content),
				authorId: authorId,
				listId: listId,
				originCardId: card.id,
				originSnapshot: toSnapshotJson(content),
				// Keep the original's order: same positions, and the same relative creation times
				// for unplaced cards (`CARD_ORDER`).
				position: card.position,
				createdAt: new Date(now - cards.length + index),
			};
		});
		await this.txHost.tx.flashCard.createMany({ data: copies });
		await this.imageRefs.added(copies.map(c => c.imageFileId));
		for (const copy of copies) {
			await this.events.resourceCreated('flashcard', copy.id, authorId);
		}
		return copies.map(c => c.id);
	}

	/** Saves a private copy of someone else's public list for the requester. */
	@Transactional()
	async forkFlashCardList(id: string, requester: Requester): Promise<FlashCardListReadModel> {
		const source = await this.txHost.tx.flashCardList.findUnique({
			where: { id: id },
			include: { cards: { orderBy: { createdAt: 'asc' } } },
		});
		if (!source || (!source.isPublic && source.authorId !== requester.id)) {
			throw new NotFoundException('FlashCardList not found');
		}
		if (source.authorId === requester.id) {
			throw new BadRequestException('You cannot save a copy of your own list');
		}

		const sameNamed = await this.txHost.tx.flashCardList.findMany({
			where: { authorId: requester.id, name: { startsWith: source.name } },
			select: { name: true },
		});
		const fork = await this.txHost.tx.flashCardList.create({
			data: {
				name: copyName(source.name, new Set(sameNamed.map(l => l.name))),
				description: source.description,
				authorId: requester.id,
				isPublic: false,
				tags: source.tags,
				forkedFromId: source.id,
				forkedFromName: source.name,
				forkedFromAuthorId: source.authorId,
				forkSyncedAt: new Date(),
			},
		});
		await this.copyCards(source.cards, fork.id, requester.id);
		return toFlashCardListReadModel(fork);
	}

	/** The requester's copy and its original (which the requester must still be able to see). */
	async findForkWithOriginal(forkId: string, requester: Requester): Promise<ForkWithOriginal> {
		const fork = await this.txHost.tx.flashCardList.findUnique({
			where: { id: forkId },
			include: { cards: true },
		});
		if (!fork || fork.authorId !== requester.id) {
			throw new NotFoundException('FlashCardList not found');
		}
		if (!fork.forkedFromId) {
			if (fork.forkedFromName) throw new NotFoundException('Original list not found');
			throw new BadRequestException('This list is not a copy of another list');
		}
		const original = await this.txHost.tx.flashCardList.findFirst({
			where: { id: fork.forkedFromId, ...visibleListsWhere(requester) },
			include: { cards: true },
		});
		if (!original) throw new NotFoundException('Original list not found');
		return { fork: fork, original: original };
	}

	/** What the copy changed relative to its original. */
	diffOf({ fork, original }: ForkWithOriginal): ListChanges {
		return computeListDiff(
			fork.cards.map(toForkCard),
			original.cards.map(toOriginalCard),
			fork.forkSyncedAt,
		);
	}

	async getFlashCardListDiff(
		forkId: string,
		requester: Requester,
	): Promise<FlashCardListDiffReadModel> {
		const pair = await this.findForkWithOriginal(forkId, requester);
		const open = await this.txHost.tx.flashCardListProposal.findFirst({
			where: {
				sourceListId: pair.fork.id,
				targetListId: pair.original.id,
				status: FlashCardProposalStatus.Open,
			},
			select: { id: true },
		});
		const changes = toListChangesReadModel(notEvaluated(this.diffOf(pair)));
		await this.imageUrls.resolve(contentsOf(changes));
		return {
			sourceListId: pair.fork.id,
			targetListId: pair.original.id,
			targetListName: pair.original.name,
			targetOwnerId: pair.original.authorId,
			changes: changes,
			openProposalId: open?.id,
		};
	}

	/** Brings the original's changes into the copy, skipping cards changed in the copy. */
	@Transactional()
	async pullFlashCardListUpstream(
		forkId: string,
		requester: Requester,
	): Promise<PullUpstreamResultReadModel> {
		const { fork: before } = await this.findForkWithOriginal(forkId, requester);
		// Move the sync time first: the row lock serialises concurrent pulls of the same copy.
		const syncedAt = new Date();
		await this.txHost.tx.flashCardList.update({
			where: { id: forkId },
			data: { forkSyncedAt: syncedAt },
		});
		// Lock the copy's cards too: an edit of one of them meanwhile (which locks the card) must not
		// change its image between the read below and the write, or the image refs would drift.
		await this.txHost.tx.$queryRaw`SELECT id FROM flash_cards WHERE list_id = ${forkId} FOR UPDATE`;
		const pair = await this.findForkWithOriginal(forkId, requester);
		const plan = planUpstreamSync(
			pair.fork.cards.map(toForkCard),
			pair.original.cards.map(toOriginalCard),
			before.forkSyncedAt,
		);

		const forkCards = new Map(pair.fork.cards.map(c => [c.id, c]));
		for (const update of plan.update) {
			await this.txHost.tx.flashCard.update({
				where: { id: update.forkCardId },
				data: {
					...cardContentData(update.content),
					originSnapshot: toSnapshotJson(update.content),
				},
			});
			// taking the original's image moves this card's reference to it
			await this.imageRefs.replaced(
				forkCards.get(update.forkCardId)?.imageFileId,
				update.content.imageFileId,
			);
		}
		const newCards = pair.original.cards.filter(c => plan.add.some(a => a.id === c.id));
		await this.copyCards(newCards, forkId, pair.fork.authorId);
		const removed = await this.imageRefs.deleteCards({ ids: plan.remove, listId: forkId });
		if (removed.length > 0) await this.events.resourcesDeleted('flashcard', removed);

		return {
			updated: plan.update.filter(u => u.contentChanged).length,
			added: newCards.length,
			removed: removed.length,
			skipped: plan.skipped,
		};
	}
}
