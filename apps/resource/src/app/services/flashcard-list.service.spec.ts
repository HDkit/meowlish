import { type ResourceEventsPublisher } from '../events/resource-events.publisher';
import { FlashcardListService } from './flashcard-list.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const list = (overrides: Record<string, unknown> = {}) => ({
	id: 'l1',
	name: 'Words',
	description: null,
	authorId: 'owner',
	isPublic: false,
	tags: [],
	createdAt: new Date('2026-01-01'),
	updatedAt: new Date('2026-01-01'),
	...overrides,
});

const setup = () => {
	const tx = {
		flashCardList: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			update: jest.fn(),
			delete: jest.fn(),
		},
		flashCard: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};
	const events = { resourcesDeleted: jest.fn() };
	const service = new FlashcardListService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
	);
	return { tx: tx, events: events, service: service };
};

describe('FlashcardListService access rules', () => {
	it('scopes list queries to public or own lists for normal users', async () => {
		const { tx, service } = setup();
		await service.listFlashCardLists({ tags: [] }, { id: 'me', privileged: false });
		const { where } = (tx.flashCardList.findMany.mock.calls as unknown[][])[0][0] as {
			where: unknown;
		};
		expect(where).toEqual({
			AND: [{}, { OR: [{ isPublic: true }, { authorId: 'me' }] }],
		});
	});

	it('does not scope list queries for privileged requesters', async () => {
		const { tx, service } = setup();
		await service.listFlashCardLists({ tags: [] }, { id: 'admin', privileged: true });
		const { where } = (tx.flashCardList.findMany.mock.calls as unknown[][])[0][0] as {
			where: unknown;
		};
		expect(where).toEqual({ AND: [{}, {}] });
	});

	it('hides a private list from other users as 404 on update', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());
		await expect(
			service.updateFlashCardList({ id: 'l1', tags: [] }, { id: 'other', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.flashCardList.update).not.toHaveBeenCalled();
	});

	it('forbids changing a public list you do not own', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list({ isPublic: true }));
		await expect(
			service.deleteFlashCardList('l1', { id: 'other', privileged: false }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(tx.flashCardList.delete).not.toHaveBeenCalled();
	});

	it('refuses to move another users card into your list', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());
		tx.flashCard.findUnique.mockResolvedValue({ id: 'c1', authorId: 'someone-else' });
		await expect(
			service.addCardToList('l1', 'c1', { id: 'owner', privileged: false }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(tx.flashCard.update).not.toHaveBeenCalled();
	});

	it('publishes ownership removal for cards cascaded with a deleted list', async () => {
		const { tx, events, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());
		tx.flashCard.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
		await service.deleteFlashCardList('l1', { id: 'owner', privileged: false });
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', ['c1', 'c2']);
	});
});
