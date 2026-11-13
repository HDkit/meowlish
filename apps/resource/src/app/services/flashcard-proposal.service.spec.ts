import { type CardContent } from '../../domain/flash-card-fork/card-content';
import { type ListChanges } from '../../domain/flash-card-fork/list-diff';
import { type ResourceEventsPublisher } from '../events/resource-events.publisher';
import { type FlashcardForkService } from './flashcard-fork.service';
import { FlashcardProposalService } from './flashcard-proposal.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from '@nestjs/common';

// Writing methods are @Transactional(); register the static host they look up (no-op adapter).
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

const content = (overrides: Partial<CardContent> = {}): CardContent => ({
	word: 'apple',
	definition: 'quả táo',
	partOfSpeech: null,
	pronunciation: null,
	examples: [],
	notes: null,
	tags: [],
	image: null,
	...overrides,
});

const changes: ListChanges = {
	added: [{ sourceCardId: 'f9', card: content({ word: 'kiwi' }) }],
	modified: [
		{
			targetCardId: 'o1',
			sourceCardId: 'f1',
			fields: ['definition'],
			base: content(),
			proposed: content({ definition: 'trái táo' }),
		},
	],
	removed: [{ targetCardId: 'o2', base: content({ word: 'pear' }) }],
};

const proposal = (overrides: Record<string, unknown> = {}) => ({
	id: 'p1',
	sourceListId: 'fork',
	targetListId: 'orig',
	authorId: 'proposer',
	title: 'Sửa nghĩa',
	message: '',
	status: 'OPEN',
	changes: changes,
	decidedAt: null,
	decidedBy: null,
	decisionNote: null,
	createdAt: new Date('2026-05-01'),
	updatedAt: new Date('2026-05-01'),
	target: { id: 'orig', name: 'IELTS', authorId: 'owner' },
	source: { id: 'fork', name: 'IELTS' },
	...overrides,
});

const row = (id: string, c: CardContent) => ({ id: id, listId: 'orig', ...c });

const firstArg = (mock: jest.Mock): unknown => (mock.mock.calls as unknown[][])[0][0];

const owner = { id: 'owner', privileged: false };
const proposer = { id: 'proposer', privileged: false };
const admin = { id: 'admin', privileged: true };
const stranger = { id: 'stranger', privileged: false };

const setup = (opts: { current?: ReturnType<typeof row>[] } = {}) => {
	let stored = proposal();
	const tx = {
		flashCardListProposal: {
			findFirst: jest.fn(({ where }: { where: { OR?: [{ authorId: string }] } }) => {
				// emulate visibleProposalsWhere: author, target owner, or privileged (no OR)
				if (!where.OR) return stored;
				const who = where.OR[0].authorId;
				return who === stored.authorId || who === stored.target.authorId ? stored : null;
			}),
			findUniqueOrThrow: jest.fn(() => stored),
			updateMany: jest.fn(({ data }: { data: object }) => {
				if (stored.status !== 'OPEN') return { count: 0 };
				stored = { ...stored, ...data };
				return { count: 1 };
			}),
			create: jest.fn(({ data }: { data: object }) => ({ ...proposal(), ...data })),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
		},
		flashCard: {
			findMany: jest
				.fn()
				.mockResolvedValue(
					opts.current ?? [row('o1', content()), row('o2', content({ word: 'pear' }))],
				),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			deleteMany: jest.fn(),
		},
	};
	const events = {
		resourceCreated: jest.fn(),
		resourcesDeleted: jest.fn(),
		flashCardProposalCreated: jest.fn(),
		flashCardProposalDecided: jest.fn(),
	};
	const forks = {
		findForkWithOriginal: jest.fn().mockResolvedValue({
			fork: { id: 'fork', authorId: 'proposer' },
			original: { id: 'orig', authorId: 'owner', name: 'IELTS' },
		}),
		diffOf: jest.fn().mockReturnValue(changes),
	};
	const service = new FlashcardProposalService(
		{ tx: tx } as never,
		events as unknown as ResourceEventsPublisher,
		forks as unknown as FlashcardForkService,
	);
	return {
		tx: tx,
		events: events,
		forks: forks,
		service: service,
		stored: () => stored,
		setStatus: (status: string) => (stored = { ...stored, status: status }),
	};
};

describe('FlashcardProposalService.createFlashCardProposal', () => {
	it('stores the diff snapshot and tells the list owner', async () => {
		const { tx, events, service } = setup();
		tx.flashCardListProposal.findFirst.mockReturnValueOnce(null);
		const created = await service.createFlashCardProposal(
			{ sourceListId: 'fork', title: '  Sửa nghĩa ', message: 'Xem giúp' },
			proposer,
		);
		const { data } = (tx.flashCardListProposal.create.mock.calls as unknown[][])[0][0] as {
			data: Record<string, unknown>;
		};
		expect(data).toMatchObject({
			sourceListId: 'fork',
			targetListId: 'orig',
			authorId: 'proposer',
			title: 'Sửa nghĩa',
			status: 'OPEN',
		});
		expect(created).toMatchObject({ addedCount: 1, modifiedCount: 1, removedCount: 1 });
		expect(events.flashCardProposalCreated).toHaveBeenCalledWith(
			expect.objectContaining({ proposalId: 'p1', targetOwnerId: 'owner', authorId: 'proposer' }),
		);
	});

	it('refuses an empty diff and a second open proposal', async () => {
		const { tx, forks, service } = setup();
		await expect(
			service.createFlashCardProposal({ sourceListId: 'fork', title: 'x' }, proposer),
		).rejects.toBeInstanceOf(ConflictException);

		tx.flashCardListProposal.findFirst.mockReturnValueOnce(null);
		forks.diffOf.mockReturnValue({ added: [], modified: [], removed: [] });
		await expect(
			service.createFlashCardProposal({ sourceListId: 'fork', title: 'x' }, proposer),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(tx.flashCardListProposal.create).not.toHaveBeenCalled();
	});
});

describe('FlashcardProposalService visibility', () => {
	it('shows a proposal to its author, the list owner and admins, and 404 to others', async () => {
		const { service } = setup();
		for (const who of [proposer, owner, admin]) {
			await expect(service.getFlashCardProposal('p1', who)).resolves.toMatchObject({ id: 'p1' });
		}
		await expect(service.getFlashCardProposal('p1', stranger)).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('lets only the owner or an admin decide, and only the author withdraw', async () => {
		const { service } = setup();
		await expect(service.getFlashCardProposal('p1', owner)).resolves.toMatchObject({
			canDecide: true,
			canWithdraw: false,
		});
		await expect(service.getFlashCardProposal('p1', proposer)).resolves.toMatchObject({
			canDecide: false,
			canWithdraw: true,
		});
		await expect(
			service.acceptFlashCardProposal({ id: 'p1', resolutions: [] }, proposer),
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.rejectFlashCardProposal('p1', undefined, stranger)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(service.withdrawFlashCardProposal('p1', owner)).rejects.toBeInstanceOf(
			ForbiddenException,
		);
	});

	it('scopes lists to visible proposals for normal users', async () => {
		const { tx, service } = setup();
		await service.listFlashCardProposals({ targetListId: 'orig' }, stranger);
		const { where } = (tx.flashCardListProposal.findMany.mock.calls as unknown[][])[0][0] as {
			where: unknown;
		};
		expect(where).toEqual({
			AND: [
				{ targetListId: 'orig' },
				{ OR: [{ authorId: 'stranger' }, { target: { authorId: 'stranger' } }] },
			],
		});
	});
});

describe('FlashcardProposalService.acceptFlashCardProposal', () => {
	it('applies added, modified and removed cards and notifies the proposer', async () => {
		const { tx, events, service, stored } = setup();
		const result = await service.acceptFlashCardProposal(
			{ id: 'p1', resolutions: [], decisionNote: 'Cảm ơn' },
			owner,
		);

		expect(result.status).toBe('ACCEPTED');
		expect(stored()).toMatchObject({ decidedBy: 'owner', decisionNote: 'Cảm ơn' });
		// added card: owned by the list owner, linked back to the proposer's card
		const created = firstArg(tx.flashCard.create) as { data: { id: string } };
		expect(created).toMatchObject({ data: { word: 'kiwi', authorId: 'owner', listId: 'orig' } });
		expect(firstArg(tx.flashCard.updateMany)).toMatchObject({
			where: { id: 'f9', listId: 'fork' },
			data: { originCardId: created.data.id },
		});
		expect(events.resourceCreated).toHaveBeenCalledWith('flashcard', expect.any(String), 'owner');
		// modified card: only the changed field
		expect(firstArg(tx.flashCard.update)).toMatchObject({
			where: { id: 'o1' },
			data: { word: 'apple', definition: 'trái táo' },
		});
		expect(tx.flashCard.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: ['o2'] }, listId: 'orig' },
		});
		expect(events.resourcesDeleted).toHaveBeenCalledWith('flashcard', ['o2']);
		expect(events.flashCardProposalDecided).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'ACCEPTED', authorId: 'proposer' }),
		);
	});

	it('keeps the owner’s later edits of other fields when applying a modification', async () => {
		const { tx, service } = setup({
			current: [row('o1', content({ notes: 'của chủ' })), row('o2', content({ word: 'pear' }))],
		});
		await service.acceptFlashCardProposal({ id: 'p1', resolutions: [] }, owner);
		expect(firstArg(tx.flashCard.update)).toMatchObject({
			where: { id: 'o1' },
			data: { definition: 'trái táo', notes: 'của chủ' },
		});
	});

	it('requires a resolution for each conflicting card', async () => {
		const conflicting = [
			row('o1', content({ definition: 'táo đỏ' })),
			row('o2', content({ word: 'pear', notes: 'mới' })),
		];
		const { service } = setup({ current: conflicting });
		await expect(
			service.acceptFlashCardProposal({ id: 'p1', resolutions: [] }, owner),
		).rejects.toBeInstanceOf(ConflictException);

		const detail = await setup({ current: conflicting }).service.getFlashCardProposal('p1', owner);
		expect(detail.conflictCount).toBe(2);
		expect(detail.changes.modified[0]).toMatchObject({
			conflict: true,
			current: { definition: 'táo đỏ' },
		});
	});

	it('applies or keeps each conflicting card as the owner chose', async () => {
		const { tx, events, service } = setup({
			current: [
				row('o1', content({ definition: 'táo đỏ' })),
				row('o2', content({ word: 'pear', notes: 'mới' })),
			],
		});
		await service.acceptFlashCardProposal(
			{
				id: 'p1',
				resolutions: [
					{ targetCardId: 'o1', apply: true },
					{ targetCardId: 'o2', apply: false },
				],
			},
			admin,
		);
		expect(firstArg(tx.flashCard.update)).toMatchObject({
			where: { id: 'o1' },
			data: { definition: 'trái táo' },
		});
		expect(tx.flashCard.deleteMany).not.toHaveBeenCalled();
		expect(events.resourcesDeleted).not.toHaveBeenCalled();
	});

	it('refuses a proposal that is no longer open', async () => {
		const { tx, service, setStatus } = setup();
		setStatus('WITHDRAWN');
		await expect(
			service.acceptFlashCardProposal({ id: 'p1', resolutions: [] }, owner),
		).rejects.toBeInstanceOf(ConflictException);
		expect(tx.flashCard.create).not.toHaveBeenCalled();
	});
});

describe('FlashcardProposalService reject and withdraw', () => {
	it('rejects with a note and notifies the proposer', async () => {
		const { events, service, stored } = setup();
		await service.rejectFlashCardProposal('p1', '  Chưa phù hợp ', owner);
		expect(stored()).toMatchObject({ status: 'REJECTED', decisionNote: 'Chưa phù hợp' });
		expect(events.flashCardProposalDecided).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'REJECTED', decisionNote: 'Chưa phù hợp' }),
		);
	});

	it('lets the author withdraw without notifying anyone', async () => {
		const { events, service, stored } = setup();
		await service.withdrawFlashCardProposal('p1', proposer);
		expect(stored().status).toBe('WITHDRAWN');
		expect(events.flashCardProposalDecided).not.toHaveBeenCalled();
	});
});
