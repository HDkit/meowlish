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
import { CardImageRefsService } from './card-image-refs.service';
import { CardImageUrlService } from './card-image-url.service';
import { FileOwnershipService } from './file-ownership.service';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma-client/resource';

@Injectable()
export class FlashcardService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
		private readonly fileOwnership: FileOwnershipService,
		private readonly imageRefs: CardImageRefsService,
		private readonly imageUrls: CardImageUrlService,
	) {}

	/**
	 * The uploader check and the URL lookup (gRPC calls) run outside the transaction, so no DB
	 * transaction waits on them. `mayAttachAnyFile` (admins) skips the check, as on reports.
	 */
	async createFlashCard(data: CreateFlashCardInput): Promise<FlashCardReadModel> {
		const imageFileId = data.imageFileId || null;
		if (imageFileId && !data.mayAttachAnyFile) {
			await this.fileOwnership.assertOwnedBy([imageFileId], data.authorId);
		}
		const created = await this.insertCard(data, imageFileId);
		await this.imageUrls.resolve([created]);
		return created;
	}

	@Transactional()
	private async insertCard(
		data: CreateFlashCardInput,
		imageFileId: string | null,
	): Promise<FlashCardReadModel> {
		const list = await this.txHost.tx.flashCardList.findUnique({ where: { id: data.listId } });
		if (!list) throw new NotFoundException('FlashCardList not found');
		if (list.authorId !== data.authorId) {
			throw new ForbiddenException('Cards can only be added to your own lists');
		}

		const created = await this.txHost.tx.flashCard.create({
			data: {
				word: data.word,
				definition: data.definition,
				imageFileId: imageFileId,
				partOfSpeech: data.partOfSpeech,
				pronunciation: data.pronunciation,
				examples: data.examples,
				notes: data.notes,
				authorId: data.authorId,
				tags: data.tags,
				listId: data.listId,
			},
		});
		await this.imageRefs.added([created.imageFileId]);
		// Still mirrored to authorization's `resource_ownership`, but no route reads it any more:
		// update/delete check the list owner here, so the author can edit the card right away.
		await this.events.resourceCreated('flashcard', created.id, created.authorId);
		return toFlashCardReadModel(created);
	}

	async getFlashCard(id: string, requester: Requester): Promise<FlashCardReadModel> {
		const entity = await this.txHost.tx.flashCard.findFirst({
			where: { id: id, list: visibleListsWhere(requester) },
		});
		if (!entity) throw new NotFoundException('FlashCard not found');
		const card = toFlashCardReadModel(entity);
		await this.imageUrls.resolve([card]);
		return card;
	}

	/**
	 * A card the requester may change: one in a list they own, or any card when privileged (admin).
	 * Everyone else gets 404, as for a missing card, so card ids in private lists don't leak.
	 */
	private async findOwnedCard(
		id: string,
		requester: Requester,
	): Promise<{ id: string; imageFileId: string | null }> {
		const card = await this.txHost.tx.flashCard.findFirst({
			where: { id: id, ...(requester.privileged ? {} : { list: { authorId: requester.id } }) },
			select: { id: true, imageFileId: true },
		});
		if (!card) throw new NotFoundException('FlashCard not found');
		return card;
	}

	/**
	 * `imageFileId`: absent keeps the image, '' removes it, an id replaces it. A new file must be
	 * the requester's upload (admins: any file); re-sending the card's current image is no change,
	 * so a copy's owner can save a card whose image someone else uploaded. The check runs before
	 * the transaction; inside it the card row is locked, and if the image changed in between so
	 * that the sent id was never checked, the update is refused (409) rather than attached unchecked.
	 */
	async updateFlashCard(
		data: UpdateFlashCardInput,
		requester: Requester,
	): Promise<FlashCardReadModel> {
		const current = await this.findOwnedCard(data.id, requester);
		const nextImage = data.imageFileId === undefined ? undefined : data.imageFileId || null;
		let checkedImage: string | null = data.mayAttachAnyFile ? (nextImage ?? null) : null;
		if (nextImage && nextImage !== current.imageFileId && !data.mayAttachAnyFile) {
			await this.fileOwnership.assertOwnedBy([nextImage], requester.id);
			checkedImage = nextImage;
		}
		const updated = await this.writeCard(data, requester, nextImage, checkedImage);
		await this.imageUrls.resolve([updated]);
		return updated;
	}

	@Transactional()
	private async writeCard(
		data: UpdateFlashCardInput,
		requester: Requester,
		nextImage: string | null | undefined,
		checkedImage: string | null,
	): Promise<FlashCardReadModel> {
		// Lock the row: two image changes at once must not both release the same old image.
		await this.txHost.tx.$queryRaw`SELECT id FROM flash_cards WHERE id = ${data.id} FOR UPDATE`;
		const current = await this.findOwnedCard(data.id, requester);
		if (nextImage && nextImage !== current.imageFileId && nextImage !== checkedImage) {
			throw new ConflictException('The card changed while saving; please try again');
		}

		const updated = await this.txHost.tx.flashCard.update({
			where: { id: data.id },
			data: {
				word: data.word,
				definition: data.definition,
				// Setting or removing an image also drops a legacy URL.
				...(nextImage === undefined ? {} : { imageFileId: nextImage, image: null }),
				partOfSpeech: data.partOfSpeech,
				pronunciation: data.pronunciation,
				examples: data.replaceExamples || data.examples.length > 0 ? data.examples : undefined,
				notes: data.notes,
				tags: data.replaceTags || data.tags.length > 0 ? data.tags : undefined,
			},
		});
		if (nextImage !== undefined) await this.imageRefs.replaced(current.imageFileId, nextImage);
		return toFlashCardReadModel(updated);
	}

	@Transactional()
	async deleteFlashCard(id: string, requester: Requester): Promise<void> {
		await this.findOwnedCard(id, requester);

		// releases the card's image; a card deleted meanwhile by someone else is a 404
		const deleted = await this.imageRefs.deleteCards({ ids: [id] });
		if (deleted.length === 0) throw new NotFoundException('FlashCard not found');
		await this.events.resourcesDeleted('flashcard', deleted);
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

		const cards = flashCards.map(toFlashCardReadModel);
		await this.imageUrls.resolve(cards);
		return { flashCards: cards, totalCount: totalCount };
	}
}
