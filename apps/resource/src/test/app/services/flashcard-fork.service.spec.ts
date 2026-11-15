import { type ResourceEventsPublisher } from '../../../app/events/resource-events.publisher';
import { FlashcardForkService } from '../../../app/services/flashcard-fork.service';
import {
	type StoredCard,
	fakeImageUrls,
	imageEvents,
	imageRefsOf,
	queryRawOver,
	refBalance,
} from '../../helpers/card-images';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Writing methods are @Transactional(); register the static host they look up (no-op adapter).
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const card = (overrides: Record<string, unknown> = {}) => ({
	id: 'o1',
	word: 'apple',
	definition: 'quả táo',
	image: null,
	imageFileId: null,
	partOfSpeech: 'noun',
	pronunciation: null,
	examples: [],
	notes: null,
	authorId: 'owner',
	tags: [],
	listId: 'orig',
	originCardId: null,
	originSnapshot: null,
	createdAt: new Date('2026-01-01'),
	updatedAt: new Date('2026-01-01'),
	...overrides,
});

const list = (overrides: Record<string, unknown> = {}) => ({
	id: 'orig',
	name: 'IELTS',
	description: 'Từ vựng',
	authorId: 'owner',
	isPublic: true,
	tags: ['ielts'],
	forkedFromId: null,
	forkedFromName: null,
	forkedFromAuthorId: null,
	forkSyncedAt: null,
	createdAt: new Date('2026-01-01'),
	updatedAt: new Date('2026-01-01'),
	cards: [card(), card({ id: 'o2', word: 'pear' })],
	...overrides,
});

const me = { id: 'me', privileged: false };

const setup = (stored: StoredCard[] = []) => {
	const tx = {
		$queryRaw: queryRawOver(stored),
		flashCardList: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn((args: { data: object }) => ({
				id: 'fork',
				createdAt: new Date(),
				updatedAt: new Date(),
				...args.data,
			})),
			update: jest.fn(),
		},
		flashCard: {
			createMany: jest.fn(),
			update: jest.fn(),
			deleteMany: jest.fn(),
		},
		flashCardListProposal: { findFirst: jest.fn() },
	};
	const events = { resourceCreated: jest.fn(), resourcesDeleted: jest.fn(), ...imageEvents() };
	const service = new FlashcardForkService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
		imageRefsOf(tx, events),
		fakeImageUrls(),
	);
	return { tx: tx, events: events, service: service };
};

describe('FlashcardForkService.forkFlashCardList', () => {
	it('creates a private copy owned by the requester with linked card copies', async () => {
		const { tx, events, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());

		const fork = await service.forkFlashCardList('orig', me);

		expect(fork).toMatchObject({
			name: 'IELTS',
			authorId: 'me',
			isPublic: false,
			forkedFromId: 'orig',
			forkedFromName: 'IELTS',
			forkedFromAuthorId: 'owner',
			forkCount: 0,
		});
		const { data } = (tx.flashCard.createMany.mock.calls as unknown[][])[0][0] as {
			data: Record<string, unknown>[];
		};
		expect(data).toHaveLength(2);
		expect(data[0]).toMatchObject({
			word: 'apple',
			authorId: 'me',
			listId: 'fork',
			originCardId: 'o1',
			originSnapshot: { word: 'apple', definition: 'quả táo' },
		});
		// copies keep the original order
		expect((data[0].createdAt as Date) < (data[1].createdAt as Date)).toBe(true);
		// ownership of every new card is mirrored to authorization
		expect(events.resourceCreated).toHaveBeenCalledTimes(2);
		expect(events.resourceCreated).toHaveBeenCalledWith('flashcard', data[0].id, 'me');
	});

	it('copies each card position, so a placed list keeps its order (C29)', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(
			list({ cards: [card({ position: 1 }), card({ id: 'o2', position: null })] }),
		);
		await service.forkFlashCardList('orig', me);
		const { data } = (tx.flashCard.createMany.mock.calls as unknown[][])[0][0] as {
			data: Record<string, unknown>[];
		};
		expect(data.map(d => d.position)).toEqual([1, null]);
	});

	it('names the copy "(bản sao)" when the user already has a list with that name', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list());
		tx.flashCardList.findMany.mockResolvedValue([{ name: 'IELTS' }]);
		const fork = await service.forkFlashCardList('orig', me);
		expect(fork.name).toBe('IELTS (bản sao)');
	});

	it('hides a private list of someone else as 404, even for admins', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list({ isPublic: false }));
		await expect(service.forkFlashCardList('orig', me)).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			service.forkFlashCardList('orig', { id: 'admin', privileged: true }),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.flashCardList.create).not.toHaveBeenCalled();
	});

	it('refuses to copy your own list', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list({ authorId: 'me' }));
		await expect(service.forkFlashCardList('orig', me)).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('FlashcardForkService diff and pull', () => {
	const synced = new Date('2026-03-01');
	const forkList = (cards: object[]) =>
		list({
			id: 'fork',
			authorId: 'me',
			isPublic: false,
			forkedFromId: 'orig',
			forkedFromName: 'IELTS',
			forkSyncedAt: synced,
			cards: cards,
		});
	const snapshot = { ...card(), id: undefined };

	it('compares the copy with its original', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([
				card({
					id: 'f1',
					listId: 'fork',
					definition: 'trái táo',
					originCardId: 'o1',
					originSnapshot: snapshot,
				}),
				card({ id: 'f9', listId: 'fork', word: 'kiwi' }),
			]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(list());
		tx.flashCardListProposal.findFirst.mockResolvedValue({ id: 'p1' });

		const diff = await service.getFlashCardListDiff('fork', me);

		expect(diff).toMatchObject({
			sourceListId: 'fork',
			targetListId: 'orig',
			targetOwnerId: 'owner',
			openProposalId: 'p1',
		});
		expect(diff.changes.added.map(c => c.card.word)).toEqual(['kiwi']);
		expect(diff.changes.modified).toMatchObject([{ targetCardId: 'o1', fields: ['definition'] }]);
		expect(diff.changes.removed.map(c => c.targetCardId)).toEqual(['o2']);
	});

	it('answers 404 for someone else’s copy and for an original that is gone or private', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(forkList([]));
		await expect(
			service.getFlashCardListDiff('fork', { id: 'other', privileged: false }),
		).rejects.toBeInstanceOf(NotFoundException);

		tx.flashCardList.findFirst.mockResolvedValue(null);
		await expect(service.getFlashCardListDiff('fork', me)).rejects.toThrow(
			'Original list not found',
		);
	});

	it('refuses to diff a list that is not a copy', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(list({ authorId: 'me' }));
		await expect(service.getFlashCardListDiff('orig', me)).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});

	it('pulls upstream edits, new cards and deletions, and moves the sync time', async () => {
		const { tx, events, service } = setup([{ id: 'f2', listId: 'fork', imageFileId: null }]);
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([
				card({ id: 'f1', listId: 'fork', originCardId: 'o1', originSnapshot: snapshot }),
				card({
					id: 'f2',
					listId: 'fork',
					word: 'gone',
					originCardId: 'o-deleted',
					originSnapshot: { ...snapshot, word: 'gone' },
				}),
			]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(
			list({
				cards: [
					card({ definition: 'táo (đã sửa)' }),
					card({ id: 'o3', word: 'new', createdAt: new Date('2026-04-01') }),
				],
			}),
		);

		const result = await service.pullFlashCardListUpstream('fork', me);

		expect(result).toEqual({ updated: 1, added: 1, removed: 1, skipped: 0 });
		const [[syncUpdate]] = tx.flashCardList.update.mock.calls as [{ data: object }][];
		expect(syncUpdate).toMatchObject({ where: { id: 'fork' } });
		expect(syncUpdate.data).toEqual({ forkSyncedAt: expect.any(Date) as unknown });
		expect((tx.flashCard.update.mock.calls as unknown[][])[0][0]).toMatchObject({
			where: { id: 'f1' },
			data: { definition: 'táo (đã sửa)' },
		});
		const deletes = (tx.$queryRaw.mock.calls as unknown as unknown[][]).filter(c =>
			(c[0] as TemplateStringsArray).join('').includes('DELETE'),
		);
		expect(deletes).toHaveLength(1);
		expect(deletes[0].slice(1)).toEqual([['f2'], 'fork', 'fork']);
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', ['f2']);
		expect(events.resourceCreated).toHaveBeenCalledTimes(1);
	});

	it("locks the copy's cards before reading them for a pull", async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(forkList([]));
		tx.flashCardList.findFirst.mockResolvedValue(list({ cards: [] }));
		await service.pullFlashCardListUpstream('fork', me);
		const [sql, id] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
		expect(sql.join('?')).toMatch(/FROM flash_cards WHERE list_id = \? FOR UPDATE/);
		expect(id).toBe('fork');
		expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
			tx.flashCardList.findUnique.mock.invocationCallOrder[1],
		);
	});
});

describe('FlashcardForkService card images', () => {
	const synced = new Date('2026-03-01');
	const forkList = (cards: object[]) =>
		list({
			id: 'fork',
			authorId: 'me',
			isPublic: false,
			forkedFromId: 'orig',
			forkedFromName: 'IELTS',
			forkSyncedAt: synced,
			cards: cards,
		});
	const snap = (overrides: Record<string, unknown> = {}) => ({
		...card(),
		id: undefined,
		...overrides,
	});

	it('a copy shares each image file and adds a reference of its own per card', async () => {
		const { tx, events, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(
			list({
				cards: [
					card({ imageFileId: 'img' }),
					card({ id: 'o2', imageFileId: 'img' }),
					card({ id: 'o3', image: 'https://example.com/legacy.png' }),
				],
			}),
		);
		await service.forkFlashCardList('orig', me);
		const { data } = (tx.flashCard.createMany.mock.calls as unknown[][])[0][0] as {
			data: Record<string, unknown>[];
		};
		expect(data.map(d => d.imageFileId)).toEqual(['img', 'img', null]);
		expect(data[2].image).toBe('https://example.com/legacy.png');
		expect(data[0].originSnapshot).toMatchObject({ imageFileId: 'img' });
		expect(refBalance(events)).toEqual({ img: 2 });
	});

	it('pulling moves references: replaced images, new cards, cards the original deleted', async () => {
		const { tx, events, service } = setup([
			{ id: 'f1', listId: 'fork', imageFileId: 'old' },
			{ id: 'f2', listId: 'fork', imageFileId: 'gone-img' },
		]);
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([
				card({
					id: 'f1',
					listId: 'fork',
					imageFileId: 'old',
					originCardId: 'o1',
					originSnapshot: snap({ imageFileId: 'old' }),
				}),
				card({
					id: 'f2',
					listId: 'fork',
					word: 'gone',
					imageFileId: 'gone-img',
					originCardId: 'o-deleted',
					originSnapshot: snap({ word: 'gone', imageFileId: 'gone-img' }),
				}),
			]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(
			list({
				cards: [
					card({ imageFileId: 'new' }),
					card({
						id: 'o3',
						word: 'kiwi',
						imageFileId: 'kiwi-img',
						createdAt: new Date('2026-04-01'),
					}),
				],
			}),
		);

		const result = await service.pullFlashCardListUpstream('fork', me);

		expect(result).toEqual({ updated: 1, added: 1, removed: 1, skipped: 0 });
		expect((tx.flashCard.update.mock.calls as unknown[][])[0][0]).toMatchObject({
			where: { id: 'f1' },
			data: { imageFileId: 'new', originSnapshot: { imageFileId: 'new' } },
		});
		expect(refBalance(events)).toEqual({ old: -1, new: 1, 'kiwi-img': 1, 'gone-img': -1 });
	});

	it('keeps a card whose image the copy changed (skipped), and its reference', async () => {
		const { tx, events, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([
				card({
					id: 'f1',
					listId: 'fork',
					imageFileId: 'mine',
					originCardId: 'o1',
					originSnapshot: snap({ imageFileId: 'old' }),
				}),
			]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(list({ cards: [card({ imageFileId: 'new' })] }));
		const result = await service.pullFlashCardListUpstream('fork', me);
		expect(result.skipped).toBe(1);
		expect(tx.flashCard.update).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({});
	});

	it('reads old snapshots without an image file as no image file', async () => {
		const { tx, events, service } = setup();
		const { imageFileId: _dropped, ...oldSnapshot } = snap();
		void _dropped;
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([
				card({ id: 'f1', listId: 'fork', originCardId: 'o1', originSnapshot: oldSnapshot }),
			]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(list({ cards: [card()] }));
		const result = await service.pullFlashCardListUpstream('fork', me);
		expect(result).toEqual({ updated: 0, added: 0, removed: 0, skipped: 0 });
		expect(refBalance(events)).toEqual({});
	});

	it('shows image URLs in the diff', async () => {
		const { tx, service } = setup();
		tx.flashCardList.findUnique.mockResolvedValue(
			forkList([card({ id: 'f9', listId: 'fork', word: 'kiwi', imageFileId: 'kiwi-img' })]),
		);
		tx.flashCardList.findFirst.mockResolvedValue(list({ cards: [] }));
		tx.flashCardListProposal.findFirst.mockResolvedValue(null);
		const diff = await service.getFlashCardListDiff('fork', me);
		expect(diff.changes.added[0].card).toMatchObject({
			imageFileId: 'kiwi-img',
			image: 'https://cdn.test/public/kiwi-img',
		});
	});
});
