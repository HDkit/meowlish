import { BlogService } from '../../../app/services/blog.service';
import { NoOpTransactionalAdapter, TransactionHost } from '@nestjs-cls/transactional';
import { NotFoundException } from '@nestjs/common';

// Writing methods are @Transactional(); register the static host they look up (no-op adapter).
new TransactionHost<NoOpTransactionalAdapter>({
	...new NoOpTransactionalAdapter({ tx: {}, disableWarning: true }).optionsFactory({}),
	connectionName: undefined,
	enableTransactionProxy: false,
	defaultTxOptions: {},
	extraProviderTokens: [],
});

describe('BlogService listBlogTags', () => {
	it('returns every tag with its post count, as the database orders them', async () => {
		const rows = [
			{ name: 'ielts', count: 4 },
			{ name: 'grammar', count: 1 },
		];
		const tx = { $queryRaw: jest.fn().mockResolvedValue(rows) };
		const service = new BlogService({ tx: tx } as never, {} as never);

		await expect(service.listBlogTags()).resolves.toEqual(rows);
		const sql = (tx.$queryRaw.mock.calls as unknown[][])[0][0] as string[];
		expect(sql.join('')).toMatch(
			/unnest\(tags\)[\s\S]*GROUP BY tag[\s\S]*ORDER BY count DESC, tag ASC/,
		);
	});
});

describe('BlogService.updateBlog tags', () => {
	const blog = { id: 'b1', title: 'T', content: 'C', authorId: 'me', tags: ['old'] };
	const setup = () => {
		const tx = {
			blog: {
				findUnique: jest.fn().mockResolvedValue(blog),
				update: jest
					.fn()
					.mockImplementation(({ data }: { data: object }) =>
						Promise.resolve({ ...blog, ...data, createdAt: new Date(), updatedAt: new Date() }),
					),
			},
		};
		return { tx: tx, service: new BlogService({ tx: tx } as never, {} as never) };
	};
	const tagsSent = (tx: ReturnType<typeof setup>['tx']) =>
		(tx.blog.update.mock.calls as [{ data: { tags: string[] } }][])[0][0].data.tags;

	it('clears the tags when the request sets them to an empty list', async () => {
		const { tx, service } = setup();
		await service.updateBlog({ id: 'b1', tags: [], replaceTags: true });
		expect(tagsSent(tx)).toEqual([]);
	});

	it('keeps the tags when the request did not send them', async () => {
		const { tx, service } = setup();
		await service.updateBlog({ id: 'b1', title: 'New', tags: [] });
		expect(tagsSent(tx)).toEqual(['old']);
	});
});

describe('BlogService slugs', () => {
	const at = new Date('2026-05-01T00:00:00Z');
	const row = (overrides: Record<string, unknown> = {}) => ({
		id: 'b1',
		slug: 'lam-the-nao-de-viet-email',
		title: 'Làm thế nào để viết email',
		content: 'C',
		authorId: 'me',
		tags: [],
		createdAt: at,
		updatedAt: at,
		...overrides,
	});
	const setup = () => {
		const tx = {
			blog: {
				findUnique: jest.fn().mockResolvedValue(null),
				findMany: jest.fn().mockResolvedValue([]),
				create: jest
					.fn()
					.mockImplementation(({ data }: { data: object }) => Promise.resolve(row({ ...data }))),
				update: jest
					.fn()
					.mockImplementation(({ data }: { data: object }) => Promise.resolve(row({ ...data }))),
			},
		};
		const events = { resourceCreated: jest.fn().mockResolvedValue(undefined) };
		return { tx: tx, service: new BlogService({ tx: tx } as never, events as never) };
	};
	const input = { title: 'Làm thế nào để viết email', content: 'C', authorId: 'me', tags: [] };
	const slugSent = (tx: ReturnType<typeof setup>['tx'], call = 0) =>
		(tx.blog.create.mock.calls as [{ data: { slug: string } }][])[call][0].data.slug;

	it('gives a new post a slug from its title', async () => {
		const { tx, service } = setup();
		const created = await service.createBlog(input);
		expect(tx.blog.findMany).toHaveBeenCalledWith({
			where: { slug: { startsWith: 'lam-the-nao-de-viet-email' } },
			select: { slug: true },
		});
		expect(slugSent(tx)).toBe('lam-the-nao-de-viet-email');
		expect(created.slug).toBe('lam-the-nao-de-viet-email');
	});

	it('adds the next free suffix when the slug is taken', async () => {
		const { tx, service } = setup();
		tx.blog.findMany.mockResolvedValue([
			{ slug: 'lam-the-nao-de-viet-email' },
			{ slug: 'lam-the-nao-de-viet-email-2' },
			{ slug: 'lam-the-nao-de-viet-email-hay' },
		]);
		await service.createBlog(input);
		expect(slugSent(tx)).toBe('lam-the-nao-de-viet-email-3');
	});

	it('falls back to "bai-viet" for a title with no usable characters', async () => {
		const { tx, service } = setup();
		await service.createBlog({ ...input, title: '???' });
		expect(slugSent(tx)).toBe('bai-viet');
	});

	it('retries with a fresh slug when another post took it first (P2002 on slug)', async () => {
		const { tx, service } = setup();
		tx.blog.create.mockRejectedValueOnce(
			Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['slug'] } }),
		);
		tx.blog.findMany
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ slug: 'lam-the-nao-de-viet-email' }]);
		const created = await service.createBlog(input);
		expect(tx.blog.create).toHaveBeenCalledTimes(2);
		expect(slugSent(tx, 1)).toBe('lam-the-nao-de-viet-email-2');
		expect(created.slug).toBe('lam-the-nao-de-viet-email-2');
	});

	it('does not retry other errors', async () => {
		const { tx, service } = setup();
		tx.blog.create.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'P2003' }));
		await expect(service.createBlog(input)).rejects.toThrow('fk');
		expect(tx.blog.create).toHaveBeenCalledTimes(1);
	});

	it('finds a post by id exactly as before', async () => {
		const { tx, service } = setup();
		tx.blog.findUnique.mockResolvedValueOnce(row());
		await expect(service.getBlog('b1')).resolves.toMatchObject({ id: 'b1' });
		expect(tx.blog.findUnique).toHaveBeenCalledTimes(1);
		expect(tx.blog.findUnique).toHaveBeenCalledWith({ where: { id: 'b1' } });
	});

	it('finds a post by slug', async () => {
		const { tx, service } = setup();
		tx.blog.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row());
		const blog = await service.getBlog('lam-the-nao-de-viet-email');
		expect(tx.blog.findUnique).toHaveBeenLastCalledWith({
			where: { slug: 'lam-the-nao-de-viet-email' },
		});
		expect(blog).toMatchObject({ id: 'b1', slug: 'lam-the-nao-de-viet-email' });
	});

	it('404s when neither the id nor a slug matches', async () => {
		const { service } = setup();
		await expect(service.getBlog('nope')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('keeps the slug when the title is edited', async () => {
		const { tx, service } = setup();
		tx.blog.findUnique.mockResolvedValue(row());
		const updated = await service.updateBlog({ id: 'b1', title: 'A new title', tags: [] });
		const data = (tx.blog.update.mock.calls as [{ data: Record<string, unknown> }][])[0][0].data;
		expect(data).not.toHaveProperty('slug');
		expect(updated).toMatchObject({ title: 'A new title', slug: 'lam-the-nao-de-viet-email' });
	});
});
