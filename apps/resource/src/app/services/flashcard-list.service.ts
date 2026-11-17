import {
	type FlashCardListDetailReadModel,
	type FlashCardListReadModel,
	type FlashCardListsPageReadModel,
} from '../../domain/read-models/flash-card-list.read-model';
import { type FlashCardListPageReadModel } from '../../domain/read-models/flash-card.read-model';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	CARD_ORDER,
	WITH_FORK_COUNT,
	toFlashCardListReadModel,
	toFlashCardReadModel,
	visibleListsWhere,
} from '../mappers/flash-card.mapper';
import {
	type CreateFlashCardListInput,
	type ListCardsInListInput,
	type ListFlashCardListsInput,
	type UpdateFlashCardListInput,
} from '../types/flash-card-list.input';
import { toSkipTake } from '../types/pagination';
import { type Requester } from '../types/requester';
import { CardImageRefsService } from './card-image-refs.service';
import { CardImageUrlService } from './card-image-url.service';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FlashCardList, Prisma, PrismaClient } from '@prisma-client/resource';
import { FlashCardProposalStatus } from '@server/typing';

@Injectable()
export class FlashcardListService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
		private readonly imageRefs: CardImageRefsService,
		private readonly imageUrls: CardImageUrlService,
	) {}

	/** Loads a list the requester may modify (owner, or privileged). */
	private async findOwnedList(id: string, requester: Requester): Promise<FlashCardList> {
		const list = await this.txHost.tx.flashCardList.findUnique({ where: { id: id } });
		// Hide lists the requester can't even see, so private list ids don't leak.
		if (!list || (!list.isPublic && list.authorId !== requester.id && !requester.privileged)) {
			throw new NotFoundException('FlashCardList not found');
		}
		if (list.authorId !== requester.id && !requester.privileged) {
			throw new ForbiddenException('You do not own this flash card list');
		}
		return list;
	}

	async createFlashCardList(data: CreateFlashCardListInput): Promise<FlashCardListReadModel> {
		const created = await this.txHost.tx.flashCardList.create({
			data: {
				name: data.name,
				description: data.description,
				authorId: data.authorId,
				isPublic: data.isPublic ?? false,
				tags: data.tags,
			},
		});
		return toFlashCardListReadModel(created);
	}

	async getFlashCardList(id: string, requester: Requester): Promise<FlashCardListDetailReadModel> {
		const entity = await this.txHost.tx.flashCardList.findFirst({
			where: { id: id, ...visibleListsWhere(requester) },
			include: { cards: { orderBy: CARD_ORDER }, ...WITH_FORK_COUNT },
		});
		if (!entity) throw new NotFoundException('FlashCardList not found');

		const mayReview = requester.privileged || entity.authorId === requester.id;
		const [openProposalCount, upstream] = await Promise.all([
			mayReview ?
				this.txHost.tx.flashCardListProposal.count({
					where: { targetListId: id, status: FlashCardProposalStatus.Open },
				})
			:	0,
			entity.forkedFromId ?
				this.txHost.tx.flashCardList.findFirst({
					where: { id: entity.forkedFromId, ...visibleListsWhere(requester) },
					select: { id: true },
				})
			:	null,
		]);

		const cards = entity.cards.map(toFlashCardReadModel);
		await this.imageUrls.resolve(cards);
		return {
			...toFlashCardListReadModel(entity),
			flashCards: cards,
			totalCards: entity.cards.length,
			openProposalCount: openProposalCount,
			upstreamAvailable: upstream !== null,
		};
	}

	async updateFlashCardList(
		data: UpdateFlashCardListInput,
		requester: Requester,
	): Promise<FlashCardListReadModel> {
		await this.findOwnedList(data.id, requester);

		const updated = await this.txHost.tx.flashCardList.update({
			where: { id: data.id },
			data: {
				name: data.name,
				description: data.description,
				isPublic: data.isPublic,
				tags: data.replaceTags || data.tags.length > 0 ? data.tags : undefined,
			},
			include: WITH_FORK_COUNT,
		});
		return toFlashCardListReadModel(updated);
	}

	@Transactional()
	async deleteFlashCardList(id: string, requester: Requester): Promise<void> {
		// Lock the list first: a card being added to it meanwhile either commits before (and is
		// deleted below) or fails its foreign key after, so no card escapes the image release.
		await this.txHost.tx.$queryRaw`SELECT id FROM flash_card_lists WHERE id = ${id} FOR UPDATE`;
		await this.findOwnedList(id, requester);

		// Delete the cards ourselves (not by the FK cascade) to release their images; their
		// ownership records must go too.
		const cardIds = await this.imageRefs.deleteCards({ listId: id });
		await this.txHost.tx.flashCardList.delete({ where: { id: id } });
		await this.events.resourcesDeleted('flashcard', cardIds);
	}

	async listFlashCardLists(
		data: ListFlashCardListsInput,
		requester: Requester,
	): Promise<FlashCardListsPageReadModel> {
		const filters: Prisma.FlashCardListWhereInput = {};
		if (data.authorId) filters.authorId = data.authorId;
		if (data.isPublic !== undefined) filters.isPublic = data.isPublic;
		if (data.tags.length > 0) filters.tags = { hasSome: data.tags };
		const name = data.name?.trim();
		if (name) filters.name = { contains: name, mode: 'insensitive' };
		const where: Prisma.FlashCardListWhereInput = {
			AND: [filters, visibleListsWhere(requester)],
		};

		const [lists, totalCount] = await Promise.all([
			this.txHost.tx.flashCardList.findMany({
				where: where,
				include: WITH_FORK_COUNT,
				...toSkipTake(data),
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.flashCardList.count({ where: where }),
		]);

		return { lists: lists.map(toFlashCardListReadModel), totalCount: totalCount };
	}

	/**
	 * Moves a card into this list (or within it) at `position`, a 0-based index in the list's current
	 * order (`CARD_ORDER`), clamped to the end; no position appends. The list's cards are renumbered
	 * 0..n-1 in their current order around it, so unplaced cards keep their place and the result is
	 * gap-free. The list row is locked first, so concurrent moves into one list don't interleave.
	 */
	@Transactional()
	async addCardToList(
		listId: string,
		flashCardId: string,
		requester: Requester,
		position?: number,
	): Promise<void> {
		await this.txHost.tx.$queryRaw`SELECT id FROM flash_card_lists WHERE id = ${listId} FOR UPDATE`;
		const list = await this.findOwnedList(listId, requester);

		const card = await this.txHost.tx.flashCard.findUnique({ where: { id: flashCardId } });
		if (!card) throw new NotFoundException('FlashCard not found');
		if (card.authorId !== list.authorId) {
			throw new ForbiddenException('Only cards by the list author can be moved into it');
		}

		const others = await this.txHost.tx.flashCard.findMany({
			where: { listId: listId, id: { not: flashCardId } },
			orderBy: CARD_ORDER,
			select: { id: true, position: true },
		});
		const index = Math.min(position ?? others.length, others.length);
		const renumbered = others
			.map((c, i) => ({ id: c.id, from: c.position, to: i < index ? i : i + 1 }))
			.filter(c => c.from !== c.to);

		await this.txHost.tx.flashCard.update({
			where: { id: flashCardId },
			data: { listId: listId, position: index },
		});
		if (renumbered.length > 0) {
			// One statement for the rest; raw, so reordering doesn't bump their `updatedAt`.
			await this.txHost.tx.$executeRaw`
				UPDATE flash_cards AS c SET position = v.position
				FROM unnest(${renumbered.map(c => c.id)}::text[], ${renumbered.map(c => c.to)}::int[])
					AS v(id, position)
				WHERE c.id = v.id`;
		}
	}

	async listCardsInList(
		data: ListCardsInListInput,
		requester: Requester,
	): Promise<FlashCardListPageReadModel> {
		const list = await this.txHost.tx.flashCardList.findFirst({
			where: { id: data.listId, ...visibleListsWhere(requester) },
			select: { id: true },
		});
		if (!list) throw new NotFoundException('FlashCardList not found');

		const where: Prisma.FlashCardWhereInput = { listId: data.listId };
		const [cards, totalCount] = await Promise.all([
			this.txHost.tx.flashCard.findMany({
				where: where,
				...toSkipTake(data),
				orderBy: CARD_ORDER,
			}),
			this.txHost.tx.flashCard.count({ where: where }),
		]);

		const flashCards = cards.map(toFlashCardReadModel);
		await this.imageUrls.resolve(flashCards);
		return { flashCards: flashCards, totalCount: totalCount };
	}
}
