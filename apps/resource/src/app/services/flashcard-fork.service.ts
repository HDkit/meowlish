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
import { FlashCardProposalStatus } from '@server/typing';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	cardContentData,
	toCardContent,
	toForkCard,
	toListChangesReadModel,
	toOriginalCard,
	toSnapshotJson,
} from '../mappers/flash-card-fork.mapper';
import { toFlashCardListReadModel, visibleListsWhere } from '../mappers/flash-card.mapper';
import { type Requester } from '../types/requester';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FlashCard, FlashCardList, PrismaClient } from '@prisma-client/resource';
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
	) {}

	/** Copy cards into `listId` for `authorId`, linked to their originals; returns the new ids. */
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
				// Keep the original's order (lists sort cards by creation time).
				createdAt: new Date(now - cards.length + index),
			};
		});
		await this.txHost.tx.flashCard.createMany({ data: copies });
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
		return {
			sourceListId: pair.fork.id,
			targetListId: pair.original.id,
			targetListName: pair.original.name,
			targetOwnerId: pair.original.authorId,
			changes: toListChangesReadModel(notEvaluated(this.diffOf(pair))),
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
		const pair = await this.findForkWithOriginal(forkId, requester);
		const plan = planUpstreamSync(
			pair.fork.cards.map(toForkCard),
			pair.original.cards.map(toOriginalCard),
			before.forkSyncedAt,
		);

		for (const update of plan.update) {
			await this.txHost.tx.flashCard.update({
				where: { id: update.forkCardId },
				data: {
					...cardContentData(update.content),
					originSnapshot: toSnapshotJson(update.content),
				},
			});
		}
		const newCards = pair.original.cards.filter(c => plan.add.some(a => a.id === c.id));
		await this.copyCards(newCards, forkId, pair.fork.authorId);
		if (plan.remove.length > 0) {
			await this.txHost.tx.flashCard.deleteMany({
				where: { id: { in: plan.remove }, listId: forkId },
			});
			await this.events.resourcesDeleted('flashcard', plan.remove);
		}

		return {
			updated: plan.update.filter(u => u.contentChanged).length,
			added: newCards.length,
			removed: plan.remove.length,
			skipped: plan.skipped,
		};
	}
}
