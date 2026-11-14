import { type ResourceEventsPublisher } from '../../../app/events/resource-events.publisher';
import { FlashcardListService } from '../../../app/services/flashcard-list.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
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

// Writing methods are @Transactional(); register the static host they look up (no-op adapter).
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const setup = () => {
	const tx = {
		$queryRaw: jest.fn().mockResolvedValue([]),
		$executeRaw: jest.fn().mockResolvedValue(0),
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

	it('searches lists by name (case-insensitive substring) and tags', async () => {
		const { tx, service } = setup();
		await service.listFlashCardLists(
			{ tags: ['toeic'], name: '  Từ vựng ', isPublic: true },
			{ id: 'me', privileged: false },
		);
		const { where } = (tx.flashCardList.findMany.mock.calls as unknown[][])[0][0] as {
			where: { AND: unknown[] };
		};
		expect(where.AND[0]).toEqual({
			isPublic: true,
			tags: { hasSome: ['toeic'] },
			name: { contains: 'Từ vựng', mode: 'insensitive' },
		});
	});

	it('hides a private list from other users as 404 on update', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());
		await expect(
			service.updateFlashCardList({ id: 'l1', tags: [] }, { id: 'other', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.flashCardList.update).not.toHaveBeenCalled();
	});

	it('clears the tags only when the request sets them', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list({ tags: ['old'] }));
		tx.flashCardList.update.mockResolvedValue({ ...list(), _count: { forks: 0 } });
		const me = { id: 'owner', privileged: false };
		const tagsOf = (call: number) =>
			(tx.flashCardList.update.mock.calls as [{ data: { tags?: string[] } }][])[call][0].data.tags;

		await service.updateFlashCardList({ id: 'l1', tags: [], replaceTags: true }, me);
		expect(tagsOf(0)).toEqual([]);

		await service.updateFlashCardList({ id: 'l1', name: 'New', tags: [] }, me);
		expect(tagsOf(1)).toBeUndefined();
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

describe('FlashcardListService card order (C29)', () => {
	const owner = { id: 'owner', privileged: false };
	const expectedOrder = [
		{ position: { sort: 'asc', nulls: 'first' } },
		{ createdAt: 'desc' },
		{ id: 'asc' },
	];

	/** The list `l1` holds `others` (in display order); card `moving` is by the list author. */
	const withList = (others: { id: string; position: number | null }[]) => {
		const ctx = setup();
		ctx.tx.flashCardList.findUnique.mockResolvedValue(list());
		ctx.tx.flashCard.findUnique.mockResolvedValue({ id: 'moving', authorId: 'owner' });
		ctx.tx.flashCard.findMany.mockResolvedValue(others);
		return ctx;
	};
	/** `[id, position]` pairs the bulk renumbering wrote. */
	const renumbered = (tx: ReturnType<typeof setup>['tx']): [string, number][] => {
		if (tx.$executeRaw.mock.calls.length === 0) return [];
		const [sql, ids, positions] = (
			tx.$executeRaw.mock.calls as [TemplateStringsArray, string[], number[]][]
		)[0];
		expect(sql.join('?')).toMatch(/UPDATE flash_cards AS c SET position = v\.position/);
		return ids.map((id, i) => [id, positions[i]]);
	};
	const movedTo = (tx: ReturnType<typeof setup>['tx']): unknown =>
		(tx.flashCard.update.mock.calls as [{ data: unknown }][])[0][0].data;

	it('pages cards in a list unplaced first (newest first), then by position', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findFirst.mockResolvedValue({ id: 'l1' });
		await service.listCardsInList({ listId: 'l1' }, owner);
		expect(tx.flashCard.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { listId: 'l1' }, orderBy: expectedOrder }),
		);
	});

	it('returns the cards of a list detail in the same order', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findFirst.mockResolvedValue({ ...list(), cards: [], _count: { forks: 0 } });
		// a reader (not the owner), so no proposal count is queried
		await service.getFlashCardList('l1', { id: 'reader', privileged: false });
		expect(tx.flashCardList.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				include: expect.objectContaining({ cards: { orderBy: expectedOrder } }) as unknown,
			}),
		);
	});

	it('appends at the end when no position is given, numbering unplaced cards first', async () => {
		const { tx, service } = withList([
			{ id: 'new', position: null },
			{ id: 'old', position: null },
		]);
		await service.addCardToList('l1', 'moving', owner);
		expect(movedTo(tx)).toEqual({ listId: 'l1', position: 2 });
		expect(renumbered(tx)).toEqual([
			['new', 0],
			['old', 1],
		]);
	});

	it('inserts at a position, shifting the cards after it', async () => {
		const { tx, service } = withList([
			{ id: 'a', position: 0 },
			{ id: 'b', position: 1 },
			{ id: 'c', position: 2 },
		]);
		await service.addCardToList('l1', 'moving', owner, 1);
		expect(movedTo(tx)).toEqual({ listId: 'l1', position: 1 });
		// `a` keeps 0, so only the shifted cards are written
		expect(renumbered(tx)).toEqual([
			['b', 2],
			['c', 3],
		]);
	});

	it('clamps a position past the end to the end', async () => {
		const { tx, service } = withList([{ id: 'a', position: 0 }]);
		await service.addCardToList('l1', 'moving', owner, 99);
		expect(movedTo(tx)).toEqual({ listId: 'l1', position: 1 });
		expect(tx.$executeRaw).not.toHaveBeenCalled();
	});

	it('moves a card within its list, closing the gap it leaves', async () => {
		// `moving` was at 0; the query excludes it, so the others close up around its new place
		const { tx, service } = withList([
			{ id: 'b', position: 1 },
			{ id: 'c', position: 2 },
		]);
		await service.addCardToList('l1', 'moving', owner, 1);
		expect(tx.flashCard.findMany).toHaveBeenCalledWith({
			where: { listId: 'l1', id: { not: 'moving' } },
			orderBy: expectedOrder,
			select: { id: true, position: true },
		});
		expect(movedTo(tx)).toEqual({ listId: 'l1', position: 1 });
		expect(renumbered(tx)).toEqual([['b', 0]]);
	});

	it('locks the list before reading its cards', async () => {
		const { tx, service } = withList([]);
		await service.addCardToList('l1', 'moving', owner, 0);
		const [sql, id] = (tx.$queryRaw.mock.calls as [TemplateStringsArray, string][])[0];
		expect(sql.join('?')).toMatch(/FROM flash_card_lists WHERE id = \? FOR UPDATE/);
		expect(id).toBe('l1');
		expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
			tx.flashCard.findMany.mock.invocationCallOrder[0],
		);
	});
});
