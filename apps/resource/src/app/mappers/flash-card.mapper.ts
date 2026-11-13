import { type FlashCardListReadModel } from '../../domain/read-models/flash-card-list.read-model';
import { type FlashCardReadModel } from '../../domain/read-models/flash-card.read-model';
import { type Requester } from '../types/requester';
import { FlashCard, FlashCardList, Prisma } from '@prisma-client/resource';

export const toFlashCardReadModel = (entity: FlashCard): FlashCardReadModel => ({
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
});

/** Include this on list queries so the read model carries the fork count. */
export const WITH_FORK_COUNT = {
	_count: { select: { forks: true } },
} satisfies Prisma.FlashCardListInclude;

export const toFlashCardListReadModel = (
	entity: FlashCardList & { _count?: { forks: number } },
): FlashCardListReadModel => ({
	id: entity.id,
	name: entity.name,
	description: entity.description ?? '',
	authorId: entity.authorId,
	isPublic: entity.isPublic,
	tags: entity.tags,
	createdAt: entity.createdAt.toISOString(),
	updatedAt: entity.updatedAt.toISOString(),
	forkedFromId: entity.forkedFromId ?? undefined,
	forkedFromName: entity.forkedFromName ?? undefined,
	forkedFromAuthorId: entity.forkedFromAuthorId ?? undefined,
	forkCount: entity._count?.forks ?? 0,
});

/** Lists the requester may read: public ones, their own, or all when privileged. */
export const visibleListsWhere = (requester: Requester): Prisma.FlashCardListWhereInput =>
	requester.privileged ? {} : { OR: [{ isPublic: true }, { authorId: requester.id }] };
