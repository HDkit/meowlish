import {
	type FlashCardListDetailReadModel,
	type FlashCardListReadModel,
	type FlashCardListsPageReadModel,
} from '../../domain/read-models/flash-card-list.read-model';
import { type FlashCardListPageReadModel } from '../../domain/read-models/flash-card.read-model';
import { FlashCardProposalStatus } from '@server/typing';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
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
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FlashCardList, Prisma, PrismaClient } from '@prisma-client/resource';

@Injectable()
export class FlashcardListService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
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
			include: { cards: true, ...WITH_FORK_COUNT },
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

		return {
			...toFlashCardListReadModel(entity),
			flashCards: entity.cards.map(toFlashCardReadModel),
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
				tags: data.tags.length > 0 ? data.tags : undefined,
			},
			include: WITH_FORK_COUNT,
		});
		return toFlashCardListReadModel(updated);
	}

	@Transactional()
	async deleteFlashCardList(id: string, requester: Requester): Promise<void> {
		await this.findOwnedList(id, requester);

		const cards = await this.txHost.tx.flashCard.findMany({
			where: { listId: id },
			select: { id: true },
		});
		// Cards are removed by the FK cascade; their ownership records must go too.
		await this.txHost.tx.flashCardList.delete({ where: { id: id } });
		await this.events.resourcesDeleted(
			'flashcard',
			cards.map(c => c.id),
		);
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

	async addCardToList(listId: string, flashCardId: string, requester: Requester): Promise<void> {
		const list = await this.findOwnedList(listId, requester);

		const card = await this.txHost.tx.flashCard.findUnique({ where: { id: flashCardId } });
		if (!card) throw new NotFoundException('FlashCard not found');
		if (card.authorId !== list.authorId) {
			throw new ForbiddenException('Only cards by the list author can be moved into it');
		}

		await this.txHost.tx.flashCard.update({
			where: { id: flashCardId },
			data: { listId: listId },
		});
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
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.flashCard.count({ where: where }),
		]);

		return { flashCards: cards.map(toFlashCardReadModel), totalCount: totalCount };
	}
}
