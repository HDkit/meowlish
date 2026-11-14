import { FlashcardService } from '../../../app/services/flashcard.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';

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

const setup = () => {
	const tx = {
		flashCard: {
			findUnique: jest.fn().mockResolvedValue(card),
			update: jest
				.fn()
				.mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...card, ...data })),
		},
	};
	return { tx: tx, service: new FlashcardService({ tx: tx } as never, {} as never) };
};

const dataOf = (tx: ReturnType<typeof setup>['tx']) =>
	(tx.flashCard.update.mock.calls[0] as [{ data: { examples?: string[]; tags?: string[] } }])[0]
		.data;

describe('FlashcardService.updateFlashCard lists', () => {
	it('clears examples and tags when the request sets them to empty lists', async () => {
		const { tx, service } = setup();
		await service.updateFlashCard({
			id: 'c1',
			examples: [],
			tags: [],
			replaceExamples: true,
			replaceTags: true,
		});
		expect(dataOf(tx)).toMatchObject({ examples: [], tags: [] });
	});

	it('keeps them when the request did not send them', async () => {
		const { tx, service } = setup();
		await service.updateFlashCard({ id: 'c1', examples: [], tags: [] });
		const data = dataOf(tx);
		expect(data.examples).toBeUndefined();
		expect(data.tags).toBeUndefined();
	});
});
