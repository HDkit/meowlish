import { type ResourceEventsPublisher } from '../events/resource-events.publisher';
import { FlashcardForkService } from './flashcard-fork.service';
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

const setup = () => {
	const tx = {
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
	const events = { resourceCreated: jest.fn(), resourcesDeleted: jest.fn() };
	const service = new FlashcardForkService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
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
		const { tx, events, service } = setup();
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
		expect(tx.flashCard.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: ['f2'] }, listId: 'fork' },
		});
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', ['f2']);
		expect(events.resourceCreated).toHaveBeenCalledTimes(1);
	});
});
