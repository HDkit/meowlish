import {
	type FlashCardListPageReadModel,
	type FlashCardReadModel,
} from '../../domain/read-models/flash-card.read-model';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import { toFlashCardReadModel, visibleListsWhere } from '../mappers/flash-card.mapper';
import {
	type CreateFlashCardInput,
	type ListFlashCardsInput,
	type UpdateFlashCardInput,
} from '../types/flash-card.input';
import { toSkipTake } from '../types/pagination';
import { type Requester } from '../types/requester';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/resource';

@Injectable()
export class FlashcardService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
	) {}

	@Transactional()
	async createFlashCard(data: CreateFlashCardInput): Promise<FlashCardReadModel> {
		const list = await this.txHost.tx.flashCardList.findUnique({ where: { id: data.listId } });
		if (!list) throw new NotFoundException('FlashCardList not found');
		if (list.authorId !== data.authorId) {
			throw new ForbiddenException('Cards can only be added to your own lists');
		}

		const created = await this.txHost.tx.flashCard.create({
			data: {
				word: data.word,
				definition: data.definition,
				image: data.image,
				partOfSpeech: data.partOfSpeech,
				pronunciation: data.pronunciation,
				examples: data.examples,
				notes: data.notes,
				authorId: data.authorId,
				tags: data.tags,
				listId: data.listId,
			},
		});
		await this.events.resourceCreated('flashcard', created.id, created.authorId);
		return toFlashCardReadModel(created);
	}

	async getFlashCard(id: string, requester: Requester): Promise<FlashCardReadModel> {
		const entity = await this.txHost.tx.flashCard.findFirst({
			where: { id: id, list: visibleListsWhere(requester) },
		});
		if (!entity) throw new NotFoundException('FlashCard not found');
		return toFlashCardReadModel(entity);
	}

	async updateFlashCard(data: UpdateFlashCardInput): Promise<FlashCardReadModel> {
		const entity = await this.txHost.tx.flashCard.findUnique({ where: { id: data.id } });
		if (!entity) throw new NotFoundException('FlashCard not found');

		const updated = await this.txHost.tx.flashCard.update({
			where: { id: data.id },
			data: {
				word: data.word,
				definition: data.definition,
				image: data.image,
				partOfSpeech: data.partOfSpeech,
				pronunciation: data.pronunciation,
				examples: data.examples.length > 0 ? data.examples : undefined,
				notes: data.notes,
				tags: data.tags.length > 0 ? data.tags : undefined,
			},
		});
		return toFlashCardReadModel(updated);
	}

	@Transactional()
	async deleteFlashCard(id: string): Promise<void> {
		const entity = await this.txHost.tx.flashCard.findUnique({ where: { id: id } });
		if (!entity) throw new NotFoundException('FlashCard not found');

		await this.txHost.tx.flashCard.delete({ where: { id: id } });
		await this.events.resourcesDeleted('flashcard', [id]);
	}

	async listFlashCards(
		data: ListFlashCardsInput,
		requester: Requester,
	): Promise<FlashCardListPageReadModel> {
		const where: Prisma.FlashCardWhereInput = { list: visibleListsWhere(requester) };
		if (data.authorId) where.authorId = data.authorId;
		if (data.tags.length > 0) where.tags = { hasSome: data.tags };

		const [flashCards, totalCount] = await Promise.all([
			this.txHost.tx.flashCard.findMany({
				where: where,
				...toSkipTake(data),
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.flashCard.count({ where: where }),
		]);

		return { flashCards: flashCards.map(toFlashCardReadModel), totalCount: totalCount };
	}
}
