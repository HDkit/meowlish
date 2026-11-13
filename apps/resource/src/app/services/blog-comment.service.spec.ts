import { MAX_COMMENT_DEPTH } from '../../domain/comments/comment-path';
import { BlogCommentService } from './blog-comment.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const at = new Date('2026-04-01T08:00:00Z');

const comment = (overrides: Record<string, unknown> = {}) => ({
	id: 'c1',
	blogId: 'b1',
	parentId: null,
	rootId: 'c1',
	path: '',
	depth: 0,
	childSeq: 0,
	authorId: 'author',
	content: 'Nice post',
	editedAt: null,
	deletedAt: null,
	createdAt: at,
	updatedAt: at,
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
		blog: { findUnique: jest.fn().mockResolvedValue({ id: 'b1' }) },
		blogComment: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			create: jest
				.fn()
				.mockImplementation(({ data }: { data: object }) =>
					Promise.resolve(comment({ ...data, createdAt: at, updatedAt: at })),
				),
			update: jest.fn(),
			delete: jest.fn(),
		},
	};
	const service = new BlogCommentService({ tx: tx } as never);
	return { tx: tx, service: service };
};

const user = (id: string) => ({ id: id, privileged: false });
const moderator = { id: 'mod', privileged: true };

describe('BlogCommentService create', () => {
	it('stores a top-level comment as its own root with an empty path', async () => {
		const { tx, service } = setup();
		const created = await service.createComment({ blogId: 'b1', content: ' Hi ' }, user('me'));
		const { data } = (tx.blogComment.create.mock.calls as unknown[][])[0][0] as {
			data: { id: string; rootId: string };
		};
		expect(data).toMatchObject({
			parentId: null,
			path: '',
			depth: 0,
			authorId: 'me',
			content: 'Hi',
		});
		expect(data.rootId).toBe(data.id);
		expect(created).toMatchObject({ depth: 0, deleted: false, replies: [] });
	});

	it("appends the parent's next segment to its path for a reply", async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockResolvedValue(
			comment({ id: 'p', rootId: 'r', path: '0003', depth: 1 }),
		);
		tx.blogComment.update.mockResolvedValue({ childSeq: 11 });
		await service.createComment({ blogId: 'b1', content: 'reply', parentId: 'p' }, user('me'));
		expect(tx.blogComment.update).toHaveBeenCalledWith({
			where: { id: 'p' },
			data: { childSeq: { increment: 1 } },
			select: { childSeq: true },
		});
		expect(tx.blogComment.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				parentId: 'p',
				rootId: 'r',
				path: '0003000b',
				depth: 2,
			}) as unknown,
		});
	});

	it('attaches replies below the maximum depth next to their parent', async () => {
		const { tx, service } = setup();
		const deepPath = '0001'.repeat(MAX_COMMENT_DEPTH);
		tx.blogComment.findUnique.mockResolvedValue(
			comment({
				id: 'deep',
				parentId: 'up',
				rootId: 'r',
				path: deepPath,
				depth: MAX_COMMENT_DEPTH,
			}),
		);
		tx.blogComment.findUniqueOrThrow.mockResolvedValue(
			comment({ id: 'up', rootId: 'r', path: deepPath.slice(4), depth: MAX_COMMENT_DEPTH - 1 }),
		);
		tx.blogComment.update.mockResolvedValue({ childSeq: 2 });
		await service.createComment({ blogId: 'b1', content: 'x', parentId: 'deep' }, user('me'));
		expect(tx.blogComment.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ parentId: 'up', depth: MAX_COMMENT_DEPTH }) as unknown,
		});
	});

	it('refuses replies to deleted comments or comments of another post', async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockResolvedValueOnce(comment({ deletedAt: at }));
		await expect(
			service.createComment({ blogId: 'b1', content: 'x', parentId: 'c1' }, user('me')),
		).rejects.toBeInstanceOf(NotFoundException);
		tx.blogComment.findUnique.mockResolvedValueOnce(comment({ blogId: 'other' }));
		await expect(
			service.createComment({ blogId: 'b1', content: 'x', parentId: 'c1' }, user('me')),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(tx.blogComment.create).not.toHaveBeenCalled();
	});

	it('404s on an unknown blog and rejects blank content', async () => {
		const { tx, service } = setup();
		await expect(
			service.createComment({ blogId: 'b1', content: '  ' }, user('me')),
		).rejects.toBeInstanceOf(BadRequestException);
		tx.blog.findUnique.mockResolvedValue(null);
		await expect(
			service.createComment({ blogId: 'nope', content: 'x' }, user('me')),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('BlogCommentService list', () => {
	it('pages top-level comments newest first and nests each thread in path order', async () => {
		const { tx, service } = setup();
		tx.blogComment.findMany
			.mockResolvedValueOnce([{ id: 'new' }, { id: 'old' }])
			.mockResolvedValueOnce([
				comment({ id: 'old', rootId: 'old' }),
				comment({ id: 'o2', parentId: 'old', rootId: 'old', path: '0002', depth: 1 }),
				comment({ id: 'new', rootId: 'new' }),
				comment({
					id: 'o1',
					parentId: 'old',
					rootId: 'old',
					path: '0001',
					depth: 1,
					deletedAt: at,
				}),
				comment({ id: 'o1a', parentId: 'o1', rootId: 'old', path: '00010001', depth: 2 }),
			]);
		tx.blogComment.count.mockResolvedValueOnce(7).mockResolvedValueOnce(12);

		const result = await service.listComments({ blogId: 'b1', page: 2, limit: 2 });

		expect((tx.blogComment.findMany.mock.calls as unknown[][])[0][0]).toEqual({
			where: { blogId: 'b1', parentId: null },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { id: true },
			skip: 2,
			take: 2,
		});
		expect((tx.blogComment.findMany.mock.calls as unknown[][])[1][0]).toEqual({
			where: { rootId: { in: ['new', 'old'] } },
		});
		expect(result.totalThreads).toBe(7);
		expect(result.totalComments).toBe(12);
		expect(result.comments.map(c => c.id)).toEqual(['new', 'old']);
		const [o1, o2] = result.comments[1].replies;
		expect([o1.id, o2.id]).toEqual(['o1', 'o2']);
		expect(o1).toMatchObject({ deleted: true, content: '', authorId: '' });
		expect(o1.replies.map(r => r.id)).toEqual(['o1a']);
	});

	it('does not query threads when the page is empty', async () => {
		const { tx, service } = setup();
		const result = await service.listComments({ blogId: 'b1' });
		expect(tx.blogComment.findMany).toHaveBeenCalledTimes(1);
		expect(result.comments).toEqual([]);
	});
});

describe('BlogCommentService edit and delete', () => {
	it('lets only the author edit, and records the edit', async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockResolvedValue(comment());
		tx.blogComment.update.mockResolvedValue(comment({ content: 'fixed', editedAt: at }));
		await expect(
			service.updateComment({ id: 'c1', content: 'x' }, moderator),
		).rejects.toBeInstanceOf(NotFoundException);
		const result = await service.updateComment({ id: 'c1', content: 'fixed' }, user('author'));
		expect(result).toMatchObject({ content: 'fixed', editedAt: at.toISOString() });
	});

	it('hides comments from anyone but the author and moderators', async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockResolvedValue(comment());
		await expect(service.deleteComment('c1', user('other'))).rejects.toBeInstanceOf(
			NotFoundException,
		);
		expect(tx.blogComment.delete).not.toHaveBeenCalled();
		expect(tx.blogComment.update).not.toHaveBeenCalled();
	});

	it('soft-deletes a comment that has replies, clearing its content', async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockResolvedValue(comment());
		tx.blogComment.count.mockResolvedValue(2);
		await service.deleteComment('c1', moderator);
		expect(tx.blogComment.update).toHaveBeenCalledWith({
			where: { id: 'c1' },
			data: { deletedAt: expect.any(Date) as unknown, content: '' },
		});
		expect(tx.blogComment.delete).not.toHaveBeenCalled();
	});

	it('removes a leaf and the placeholders it was the last reply of', async () => {
		const { tx, service } = setup();
		tx.blogComment.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
			Promise.resolve(
				{
					leaf: comment({ id: 'leaf', parentId: 'ph', authorId: 'author' }),
					ph: comment({ id: 'ph', parentId: 'live', deletedAt: at }),
					live: comment({ id: 'live', parentId: null }),
				}[where.id],
			),
		);
		tx.blogComment.count.mockResolvedValue(0);
		await service.deleteComment('leaf', user('author'));
		expect(tx.blogComment.delete.mock.calls).toEqual([
			[{ where: { id: 'leaf' } }],
			[{ where: { id: 'ph' } }],
		]);
	});
});
