import { FlashcardService } from '../../../app/services/flashcard.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { NotFoundException } from '@nestjs/common';

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

const setup = () => {
	const tx = {
		flashCardList: {
			findUnique: jest.fn().mockResolvedValue({ id: 'l1', authorId: 'me' }),
		},
		flashCard: {
			findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
			create: jest
				.fn()
				.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...card, ...data })),
			update: jest
				.fn()
				.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...card, ...data })),
			delete: jest.fn(),
		},
	};
	const events = { resourceCreated: jest.fn(), resourcesDeleted: jest.fn() };
	return {
		tx: tx,
		events: events,
		service: new FlashcardService({ tx: tx } as never, events as never),
	};
};

const dataOf = (tx: ReturnType<typeof setup>['tx']) =>
	(tx.flashCard.update.mock.calls[0] as [{ data: { examples?: string[]; tags?: string[] } }])[0]
		.data;

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
			select: { id: true },
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
		expect(tx.flashCard.delete).not.toHaveBeenCalled();
		expect(events.resourcesDeleted).not.toHaveBeenCalled();
	});

	it('lets privileged requesters (admins) change any card', async () => {
		const { tx, service } = setup();
		const admin = { id: 'admin', privileged: true };
		await service.updateFlashCard(input, admin);
		await service.deleteFlashCard('c1', admin);
		expect(tx.flashCard.findFirst.mock.calls).toEqual([
			[{ where: { id: 'c1' }, select: { id: true } }],
			[{ where: { id: 'c1' }, select: { id: true } }],
		]);
		expect(tx.flashCard.update).toHaveBeenCalled();
		expect(tx.flashCard.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
	});

	it('lets the author edit and delete a card right after creating it', async () => {
		// No ownership event has to be consumed first: the check reads the list owner here.
		const { tx, events, service } = setup();
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
		expect(tx.flashCard.delete).toHaveBeenCalled();
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', [created.id]);
	});
});
