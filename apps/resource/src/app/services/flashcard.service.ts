import { Injectable, NotFoundException } from '@nestjs/common';
import { FlashCard, Prisma, PrismaClient } from '@prisma-client/resource';
import { resource } from '@server/generated';

@Injectable()
export class FlashcardService {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = new PrismaClient();
	}

	private mapToResponse(entity: FlashCard): resource.FlashCardResponse {
		return {
			id: entity.id,
			word: entity.word,
			definition: entity.definition,
			image: entity.image ?? undefined,
			partOfSpeech: entity.partOfSpeech ?? undefined,
			pronunciation: entity.pronunciation ?? undefined,
			examples: entity.examples,
			notes: entity.notes ?? undefined,
			authorId: entity.authorId,
			tags: entity.tags,
			createdAt: entity.createdAt.toISOString(),
			updatedAt: entity.updatedAt.toISOString(),
		};
	}

	async createFlashCard(
		data: resource.CreateFlashCardRequest,
	): Promise<resource.FlashCardResponse> {
		const created = await this.prisma.flashCard.create({
			data: {
				word: data.word as string,
				definition: data.definition as string,
				image: data.image,
				partOfSpeech: data.partOfSpeech,
				pronunciation: data.pronunciation,
				examples: data.examples || [],
				notes: data.notes,
				authorId: data.authorId as string,
				tags: data.tags || [],
				listId: data.listId as string,
			},
		});
		return this.mapToResponse(created);
	}

	async getFlashCard(id: string): Promise<resource.FlashCardResponse> {
		const entity = await this.prisma.flashCard.findUnique({ where: { id: id } });
		if (!entity) throw new NotFoundException('FlashCard not found');
		return this.mapToResponse(entity);
	}

	async updateFlashCard(
		data: resource.UpdateFlashCardRequest,
	): Promise<resource.FlashCardResponse> {
		const entity = await this.prisma.flashCard.findUnique({ where: { id: data.id } });
		if (!entity) throw new NotFoundException('FlashCard not found');

		const updated = await this.prisma.flashCard.update({
			where: { id: data.id },
			data: {
				word: data.word ?? undefined,
				definition: data.definition ?? undefined,
				image: data.image ?? undefined,
				partOfSpeech: data.partOfSpeech ?? undefined,
				pronunciation: data.pronunciation ?? undefined,
				examples: data.examples && data.examples.length > 0 ? data.examples : undefined,
				notes: data.notes ?? undefined,
				tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
			},
		});
		return this.mapToResponse(updated);
	}

	async deleteFlashCard(id: string): Promise<void> {
		const entity = await this.prisma.flashCard.findUnique({ where: { id: id } });
		if (!entity) throw new NotFoundException('FlashCard not found');

		await this.prisma.flashCard.delete({ where: { id: id } });
	}

	async listFlashCards(
		data: resource.ListFlashCardsRequest,
	): Promise<resource.ListFlashCardsResponse> {
		const page = data.page || 1;
		const limit = data.limit || 10;
		const skip = (page - 1) * limit;

		const where: Prisma.FlashCardWhereInput = {};
		if (data.authorId) {
			where.authorId = data.authorId;
		}
		if (data.tags && data.tags.length > 0) {
			where.tags = { hasSome: data.tags };
		}

		const [flashCards, totalCount] = await Promise.all([
			this.prisma.flashCard.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.flashCard.count({ where: where }),
		]);

		return {
			flashCards: flashCards.map(fc => this.mapToResponse(fc)),
			totalCount: totalCount,
		};
	}
}
