import { type FileOwnershipService } from '../../../app/services/file-ownership.service';
import { FlashcardService } from '../../../app/services/flashcard.service';
import {
	type StoredCard,
	fakeImageUrls,
	imageEvents,
	imageRefsOf,
	queryRawOver,
	refBalance,
} from '../../helpers/card-images';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const card = {
	id: 'c1',
	word: 'w',
	definition: 'd',
	examples: ['old'],
	tags: ['t'],
	listId: 'l1',
	authorId: 'me',
	createdAt: new Date(),
	updatedAt: new Date(),
};

const me = { id: 'me', privileged: false };

const setup = (opts: { imageFileId?: string | null; foreign?: string[] } = {}) => {
	const stored: StoredCard[] = [{ id: 'c1', listId: 'l1', imageFileId: opts.imageFileId ?? null }];
	const tx = {
		$queryRaw: queryRawOver(stored),
		flashCardList: {
			findUnique: jest.fn().mockResolvedValue({ id: 'l1', authorId: 'me' }),
		},
		flashCard: {
			findFirst: jest.fn((): Promise<object | null> =>
				Promise.resolve(stored[0] ? { id: 'c1', imageFileId: stored[0].imageFileId } : null),
			),
			create: jest.fn(({ data }: { data: object }) =>
				Promise.resolve({ ...card, image: null, imageFileId: null, ...data }),
			),
			update: jest.fn(({ data }: { data: { imageFileId?: string | null } }) => {
				if (data.imageFileId !== undefined && stored[0]) stored[0].imageFileId = data.imageFileId;
				return Promise.resolve({
					...card,
					image: null,
					imageFileId: stored[0]?.imageFileId ?? null,
					...data,
				});
			}),
		},
	};
	const events = { resourceCreated: jest.fn(), resourcesDeleted: jest.fn(), ...imageEvents() };
	const fileOwnership = {
		assertOwnedBy: jest.fn((ids: string[]) =>
			ids.some(id => opts.foreign?.includes(id)) ?
				Promise.reject(new ForbiddenException('not yours'))
			:	Promise.resolve(),
		),
	};
	const imageUrls = fakeImageUrls();
	return {
		tx: tx,
		events: events,
		fileOwnership: fileOwnership,
		imageUrls: imageUrls,
		service: new FlashcardService(
			{ tx: tx } as never,
			events as never,
			fileOwnership as unknown as FileOwnershipService,
			imageRefsOf(tx, events),
			imageUrls,
		),
	};
};

const dataOf = (tx: ReturnType<typeof setup>['tx']) =>
	(tx.flashCard.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

const isDelete = (call: unknown[]): boolean =>
	(call[0] as TemplateStringsArray).join('').includes('DELETE');

describe('FlashcardService.updateFlashCard lists', () => {
	it('clears examples and tags when the request sets them to empty lists', async () => {
		const { tx, service } = setup();
		await service.updateFlashCard(
			{
				id: 'c1',
				examples: [],
				tags: [],
				replaceExamples: true,
				replaceTags: true,
			},
			me,
		);
		expect(dataOf(tx)).toMatchObject({ examples: [], tags: [] });
	});

	it('keeps them when the request did not send them', async () => {
		const { tx, service } = setup();
		await service.updateFlashCard({ id: 'c1', examples: [], tags: [] }, me);
		const data = dataOf(tx);
		expect(data.examples).toBeUndefined();
		expect(data.tags).toBeUndefined();
	});
});

describe('FlashcardService ownership (C32)', () => {
	const input = { id: 'c1', word: 'new', examples: [], tags: [] };

	it("looks a card up through its list's author for normal requesters", async () => {
		const { tx, service } = setup();
		await service.updateFlashCard(input, me);
		expect(tx.flashCard.findFirst).toHaveBeenCalledWith({
			where: { id: 'c1', list: { authorId: 'me' } },
			select: { id: true, imageFileId: true },
		});
	});

	it('404s on update and delete when the card is not in your list', async () => {
		const { tx, events, service } = setup();
		tx.flashCard.findFirst.mockResolvedValue(null);
		const stranger = { id: 'stranger', privileged: false };
		await expect(service.updateFlashCard(input, stranger)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.deleteFlashCard('c1', stranger)).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.flashCard.update).not.toHaveBeenCalled();
		expect(tx.$queryRaw.mock.calls.some(isDelete)).toBe(false);
		expect(events.resourcesDeleted).not.toHaveBeenCalled();
	});

	it('lets privileged requesters (admins) change any card', async () => {
		const { tx, events, service } = setup();
		const admin = { id: 'admin', privileged: true };
		await service.updateFlashCard(input, admin);
		await service.deleteFlashCard('c1', admin);
		for (const [arg] of tx.flashCard.findFirst.mock.calls as unknown as [unknown][]) {
			expect(arg).toEqual({ where: { id: 'c1' }, select: { id: true, imageFileId: true } });
		}
		expect(tx.flashCard.update).toHaveBeenCalled();
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', ['c1']);
	});

	it('lets the author edit and delete a card right after creating it', async () => {
		// No ownership event has to be consumed first: the check reads the list owner here.
		const { events, service } = setup();
		const created = await service.createFlashCard({
			word: 'w',
			definition: 'd',
			examples: [],
			tags: [],
			authorId: 'me',
			listId: 'l1',
		});
		await expect(service.updateFlashCard({ ...input, id: created.id }, me)).resolves.toMatchObject({
			word: 'new',
		});
		await service.deleteFlashCard(created.id, me);
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', [created.id]);
	});
});

describe('FlashcardService card images', () => {
	const base = { word: 'w', definition: 'd', examples: [], tags: [], authorId: 'me', listId: 'l1' };
	const createData = (tx: ReturnType<typeof setup>['tx']) =>
		(tx.flashCard.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

	it('creates a card with an uploaded image: checks the uploader, adds a reference, returns the URL', async () => {
		const { tx, events, fileOwnership, service } = setup();
		const created = await service.createFlashCard({ ...base, imageFileId: 'f1' });
		expect(fileOwnership.assertOwnedBy).toHaveBeenCalledWith(['f1'], 'me');
		expect(createData(tx)).toMatchObject({ imageFileId: 'f1' });
		expect(refBalance(events)).toEqual({ f1: 1 });
		expect(created).toMatchObject({ imageFileId: 'f1', image: 'https://cdn.test/public/f1' });
	});

	it("refuses someone else's upload unless the gateway allows any file (admins)", async () => {
		const { tx, events, service } = setup({ foreign: ['theirs'] });
		await expect(
			service.createFlashCard({ ...base, imageFileId: 'theirs' }),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(tx.flashCard.create).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({});

		const admin = setup({ foreign: ['theirs'] });
		await admin.service.createFlashCard({ ...base, imageFileId: 'theirs', mayAttachAnyFile: true });
		expect(admin.fileOwnership.assertOwnedBy).not.toHaveBeenCalled();
		expect(refBalance(admin.events)).toEqual({ theirs: 1 });
	});

	it('creates a card without an image: no check, no reference', async () => {
		const { events, fileOwnership, service } = setup();
		await service.createFlashCard({ ...base, imageFileId: '' });
		expect(fileOwnership.assertOwnedBy).not.toHaveBeenCalled();
		expect(events.fileAdded).not.toHaveBeenCalled();
		expect(events.filesRemoved).not.toHaveBeenCalled();
	});

	it('replacing an image releases the old one and references the new one', async () => {
		const { tx, events, service } = setup({ imageFileId: 'old' });
		const updated = await service.updateFlashCard(
			{ id: 'c1', examples: [], tags: [], imageFileId: 'new' },
			me,
		);
		expect(dataOf(tx)).toMatchObject({ imageFileId: 'new', image: null });
		expect(refBalance(events)).toEqual({ old: -1, new: 1 });
		expect(updated.image).toBe('https://cdn.test/public/new');
	});

	it("removing an image ('') releases it and clears a legacy URL", async () => {
		const { tx, events, fileOwnership, service } = setup({ imageFileId: 'old' });
		await service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: '' }, me);
		expect(dataOf(tx)).toMatchObject({ imageFileId: null, image: null });
		expect(fileOwnership.assertOwnedBy).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({ old: -1 });
	});

	it('leaves the image (and its reference) alone when the update does not send one', async () => {
		const { tx, events, service } = setup({ imageFileId: 'old' });
		await service.updateFlashCard({ id: 'c1', word: 'x', examples: [], tags: [] }, me);
		expect(dataOf(tx)).not.toHaveProperty('imageFileId');
		expect(dataOf(tx)).not.toHaveProperty('image');
		expect(refBalance(events)).toEqual({});
	});

	it("re-sending the card's current image is no change, even if someone else uploaded it", async () => {
		const { events, fileOwnership, service } = setup({
			imageFileId: 'theirs',
			foreign: ['theirs'],
		});
		await service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: 'theirs' }, me);
		expect(fileOwnership.assertOwnedBy).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({});
	});

	it("refuses to attach someone else's upload on update", async () => {
		const { tx, events, service } = setup({ imageFileId: 'old', foreign: ['theirs'] });
		await expect(
			service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: 'theirs' }, me),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(tx.flashCard.update).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({});
	});

	it('locks the card before reading its image in the transaction', async () => {
		const { tx, service } = setup({ imageFileId: 'old' });
		await service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: 'new' }, me);
		const [sql, id] = tx.$queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
		expect(sql.join('?')).toMatch(/FROM flash_cards WHERE id = \? FOR UPDATE/);
		expect(id).toBe('c1');
	});

	it('409s when the image changed between the uploader check and the locked write', async () => {
		// The card showed 'theirs' (so it was not checked), but once the row is locked it shows
		// something else: attaching 'theirs' now would skip the uploader check.
		const { tx, events, service } = setup({ imageFileId: 'theirs', foreign: ['theirs'] });
		tx.flashCard.findFirst
			.mockResolvedValueOnce({ id: 'c1', imageFileId: 'theirs' })
			.mockResolvedValueOnce({ id: 'c1', imageFileId: 'other' });
		await expect(
			service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: 'theirs' }, me),
		).rejects.toBeInstanceOf(ConflictException);
		expect(tx.flashCard.update).not.toHaveBeenCalled();
		expect(refBalance(events)).toEqual({});
	});

	it('deleting a card releases its image, once', async () => {
		const { tx, events, service } = setup({ imageFileId: 'img' });
		await service.deleteFlashCard('c1', me);
		expect(refBalance(events)).toEqual({ img: -1 });
		// deleted meanwhile by someone else: DELETE … RETURNING finds nothing, nothing is released
		tx.flashCard.findFirst.mockResolvedValueOnce({ id: 'c1', imageFileId: 'img' });
		await expect(service.deleteFlashCard('c1', me)).rejects.toBeInstanceOf(NotFoundException);
		expect(refBalance(events)).toEqual({ img: -1 });
	});

	it('set, replace, remove and delete leave every reference balanced', async () => {
		const { events, service } = setup();
		const edit = (imageFileId: string) =>
			service.updateFlashCard({ id: 'c1', examples: [], tags: [], imageFileId: imageFileId }, me);
		await edit('a');
		await edit('b');
		await edit('');
		await edit('c');
		await service.deleteFlashCard('c1', me);
		expect(refBalance(events)).toEqual({});
	});

	it('returns legacy URL-only cards with their URL', async () => {
		const { tx, service } = setup();
		tx.flashCard.findFirst.mockResolvedValueOnce({
			...card,
			image: 'https://example.com/a.png',
			imageFileId: null,
		});
		const got = await service.getFlashCard('c1', me);
		expect(got.image).toBe('https://example.com/a.png');
		expect(got.imageFileId).toBeUndefined();
	});
});
