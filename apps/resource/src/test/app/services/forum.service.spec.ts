import { ForumService } from '../../../app/services/forum.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const at = new Date('2026-03-01T10:00:00Z');

const thread = (overrides: Record<string, unknown> = {}) => ({
	id: 't1',
	categoryId: 'ielts',
	authorId: 'author',
	title: 'Task 2 help',
	body: 'How do I **plan** an essay?',
	isPinned: false,
	isLocked: false,
	replyCount: 0,
	viewCount: 0,
	lastActivityAt: at,
	lastReplyAuthorId: null,
	editedAt: null,
	createdAt: at,
	updatedAt: at,
	category: { name: 'IELTS' },
	...overrides,
});

const reply = (overrides: Record<string, unknown> = {}) => ({
	id: 'r1',
	threadId: 't1',
	authorId: 'replier',
	body: 'Outline first.',
	quotedReplyId: null,
	quotedReply: null,
	editedAt: null,
	createdAt: at,
	updatedAt: at,
	thread: thread(),
	...overrides,
});

const category = (overrides: Record<string, unknown> = {}) => ({
	id: 'ielts',
	name: 'IELTS',
	description: '',
	position: 1,
	moderatorsOnly: false,
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
		forumCategory: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
		forumThread: {
			findUnique: jest.fn(),
			findFirst: jest.fn().mockResolvedValue(null),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			groupBy: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		forumReply: {
			findUnique: jest.fn(),
			findFirst: jest.fn().mockResolvedValue(null),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};
	const events = { forumReplyCreated: jest.fn().mockResolvedValue(undefined) };
	const service = new ForumService({ tx: tx } as never, events as never);
	return { tx: tx, service: service, events: events };
};

const user = (id: string) => ({ id: id, privileged: false });
const moderator = { id: 'mod', privileged: true };

describe('ForumService threads', () => {
	it('creates a thread as the requester, trimming title and body', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findUnique.mockResolvedValue(category());
		tx.forumThread.create.mockResolvedValue(thread());
		await service.createThread(
			{ categoryId: 'ielts', title: '  Task 2 help ', body: ' body ' },
			user('me'),
		);
		expect(tx.forumThread.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { categoryId: 'ielts', authorId: 'me', title: 'Task 2 help', body: 'body' },
			}),
		);
	});

	it('rejects a blank title', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findUnique.mockResolvedValue(category());
		await expect(
			service.createThread({ categoryId: 'ielts', title: '   ', body: 'x' }, user('me')),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('lets only moderators open threads in a moderators-only category', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findUnique.mockResolvedValue(category({ moderatorsOnly: true }));
		tx.forumThread.create.mockResolvedValue(thread());
		const input = { categoryId: 'news', title: 'Update', body: 'Hi' };
		await expect(service.createThread(input, user('me'))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		await expect(service.createThread(input, moderator)).resolves.toMatchObject({ id: 't1' });
	});

	it('answers 404 when someone edits a thread they did not write, moderators included', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		await expect(
			service.updateThread({ id: 't1', title: 'x' }, user('other')),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.updateThread({ id: 't1', title: 'x' }, moderator)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(tx.forumThread.update).not.toHaveBeenCalled();
	});

	it('lets the author edit and records the edit time', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumThread.update.mockResolvedValue(thread({ editedAt: at }));
		const result = await service.updateThread({ id: 't1', body: 'new' }, user('author'));
		const call = (tx.forumThread.update.mock.calls as unknown[][])[0][0] as {
			data: { title?: string; body: string; editedAt: Date };
		};
		expect(call.data.title).toBeUndefined();
		expect(call.data.body).toBe('new');
		expect(call.data.editedAt).toBeInstanceOf(Date);
		expect(result.editedAt).toBe(at.toISOString());
	});

	it('blocks the author from editing a locked thread', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread({ isLocked: true }));
		await expect(
			service.updateThread({ id: 't1', body: 'new' }, user('author')),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('lets the author or a moderator delete a thread, and nobody else', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		await expect(service.deleteThread('t1', user('other'))).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await service.deleteThread('t1', user('author'));
		await service.deleteThread('t1', moderator);
		expect(tx.forumThread.delete).toHaveBeenCalledTimes(2);
	});

	it('pins and locks only for moderators', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumThread.update.mockResolvedValue(thread({ isPinned: true }));
		await expect(
			service.moderateThread({ id: 't1', isPinned: true }, user('author')),
		).rejects.toBeInstanceOf(ForbiddenException);
		await service.moderateThread({ id: 't1', isPinned: true }, moderator);
		expect(tx.forumThread.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { isPinned: true, isLocked: undefined } }),
		);
	});

	it('lists threads pinned first, then by last activity, with a title search', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findUnique.mockResolvedValue(category());
		tx.forumThread.findMany.mockResolvedValue([thread({ body: '## Hi\n\n**bold** text' })]);
		tx.forumThread.count.mockResolvedValue(1);
		const result = await service.listThreads({
			categoryId: 'ielts',
			search: ' essay ',
			page: 2,
			limit: 5,
		});
		expect(tx.forumThread.findMany).toHaveBeenCalledWith({
			where: { categoryId: 'ielts', title: { contains: 'essay', mode: 'insensitive' } },
			orderBy: [{ isPinned: 'desc' }, { lastActivityAt: 'desc' }, { id: 'desc' }],
			skip: 5,
			take: 5,
		});
		expect(result.threads[0].excerpt).toBe('Hi bold text');
		expect(result.totalCount).toBe(1);
	});

	it('404s on an unknown category', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findUnique.mockResolvedValue(null);
		await expect(service.listThreads({ categoryId: 'nope' })).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it('counts a view when a thread is read', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumThread.update.mockResolvedValue(thread({ viewCount: 1 }));
		const result = await service.getThread('t1');
		expect(tx.forumThread.update).toHaveBeenCalledWith(
			expect.objectContaining({ data: { viewCount: { increment: 1 } } }),
		);
		expect(result).toMatchObject({ viewCount: 1, categoryName: 'IELTS' });
	});

	it('summarises categories with totals and their most active thread', async () => {
		const { tx, service } = setup();
		tx.forumCategory.findMany.mockResolvedValue([category(), category({ id: 'toeic' })]);
		tx.forumThread.groupBy.mockResolvedValue([
			{ categoryId: 'ielts', _count: { _all: 3 }, _sum: { replyCount: 7 } },
		]);
		tx.forumThread.findFirst.mockImplementation(({ where }: { where: { categoryId: string } }) =>
			Promise.resolve(where.categoryId === 'ielts' ? thread() : null),
		);
		const { categories } = await service.listCategories();
		expect(categories[0]).toMatchObject({
			threadCount: 3,
			replyCount: 7,
			latestThread: { id: 't1' },
		});
		expect(categories[1]).toMatchObject({ threadCount: 0, replyCount: 0, latestThread: undefined });
	});
});

describe('ForumService replies', () => {
	it('adds a reply as the requester and bumps the thread', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumReply.create.mockResolvedValue(reply({ authorId: 'me' }));
		tx.forumReply.count.mockResolvedValue(2);
		const result = await service.createReply({ threadId: 't1', body: ' hi ' }, user('me'));
		expect(tx.forumReply.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { threadId: 't1', authorId: 'me', body: 'hi', quotedReplyId: null },
			}),
		);
		expect(tx.forumThread.update).toHaveBeenCalledWith({
			where: { id: 't1' },
			data: { replyCount: { increment: 1 }, lastActivityAt: at, lastReplyAuthorId: 'me' },
		});
		expect(result.position).toBe(3);
	});

	it('announces the reply with the thread author and the quoted author', async () => {
		const { tx, service, events } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumReply.findFirst.mockResolvedValue({ id: 'q1', authorId: 'quoted' });
		tx.forumReply.create.mockResolvedValue(reply({ id: 'r9', authorId: 'me', body: '**Agree**' }));
		tx.forumReply.count.mockResolvedValue(4);
		await service.createReply(
			{ threadId: 't1', body: '**Agree**', quotedReplyId: 'q1' },
			user('me'),
		);
		expect(events.forumReplyCreated).toHaveBeenCalledWith({
			replyId: 'r9',
			threadId: 't1',
			threadTitle: 'Task 2 help',
			threadAuthorId: 'author',
			authorId: 'me',
			quotedAuthorId: 'quoted',
			excerpt: 'Agree',
			position: 5,
		});
	});

	it('refuses replies to a locked thread except from moderators', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread({ isLocked: true }));
		tx.forumReply.create.mockResolvedValue(reply());
		await expect(
			service.createReply({ threadId: 't1', body: 'hi' }, user('me')),
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.createReply({ threadId: 't1', body: 'hi' }, moderator),
		).resolves.toMatchObject({ id: 'r1' });
	});

	it('only quotes replies from the same thread', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumReply.findFirst.mockResolvedValue(null);
		await expect(
			service.createReply({ threadId: 't1', body: 'hi', quotedReplyId: 'elsewhere' }, user('me')),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.forumReply.findFirst).toHaveBeenCalledWith({
			where: { id: 'elsewhere', threadId: 't1' },
			select: { id: true, authorId: true },
		});
		expect(tx.forumReply.create).not.toHaveBeenCalled();
	});

	it('returns quotes as excerpts and numbers replies by page', async () => {
		const { tx, service } = setup();
		tx.forumThread.findUnique.mockResolvedValue(thread());
		tx.forumReply.findMany.mockResolvedValue([
			reply({ id: 'r21', quotedReply: { id: 'r3', authorId: 'x', body: '> nested\n\n**Yes**' } }),
			reply({ id: 'r22' }),
		]);
		tx.forumReply.count.mockResolvedValue(22);
		const result = await service.listReplies({ threadId: 't1', page: 3, limit: 10 });
		expect(result.replies.map(r => r.position)).toEqual([21, 22]);
		expect(result.replies[0].quotedReply).toEqual({
			id: 'r3',
			authorId: 'x',
			excerpt: 'nested Yes',
		});
		expect(result.totalCount).toBe(22);
	});

	it('lets only the author edit a reply', async () => {
		const { tx, service } = setup();
		tx.forumReply.findUnique.mockResolvedValue(reply());
		tx.forumReply.update.mockResolvedValue(reply({ body: 'edited' }));
		await expect(service.updateReply({ id: 'r1', body: 'x' }, moderator)).rejects.toBeInstanceOf(
			NotFoundException,
		);
		await expect(
			service.updateReply({ id: 'r1', body: 'edited' }, user('replier')),
		).resolves.toMatchObject({ body: 'edited' });
	});

	it('deletes for the author or a moderator and recomputes the thread counters', async () => {
		const { tx, service } = setup();
		tx.forumReply.findUnique.mockResolvedValue(reply());
		const earlier = new Date('2026-02-01T00:00:00Z');
		tx.forumReply.count.mockResolvedValue(4);
		tx.forumReply.findFirst.mockResolvedValue({ authorId: 'someone', createdAt: earlier });

		await expect(service.deleteReply('r1', user('other'))).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(tx.forumReply.delete).not.toHaveBeenCalled();

		await service.deleteReply('r1', moderator);
		expect(tx.forumReply.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
		expect(tx.forumThread.update).toHaveBeenCalledWith({
			where: { id: 't1' },
			data: { replyCount: 4, lastActivityAt: earlier, lastReplyAuthorId: 'someone' },
		});
	});

	it('falls back to the thread creation time when the last reply goes', async () => {
		const { tx, service } = setup();
		tx.forumReply.findUnique.mockResolvedValue(reply());
		await service.deleteReply('r1', user('replier'));
		expect(tx.forumThread.update).toHaveBeenCalledWith({
			where: { id: 't1' },
			data: { replyCount: 0, lastActivityAt: at, lastReplyAuthorId: null },
		});
	});
});
