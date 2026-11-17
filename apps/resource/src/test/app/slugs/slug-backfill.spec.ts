import { backfillSlugs } from '../../../app/slugs/slug-backfill';

interface Row {
	id: string;
	title: string;
	slug: string | null;
	createdAt: Date;
}

interface FindManyArgs {
	where: { slug: null | { startsWith: string }; id?: { notIn: string[] } };
	take?: number;
}

const conflict = () =>
	Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['slug'] } });

/** In-memory table with the queries the backfill makes, enforcing slug uniqueness. */
const table = (rows: Row[]) => {
	const findMany = jest.fn(({ where, take }: FindManyArgs) => {
		const slugWhere = where.slug;
		if (slugWhere === null) {
			const skip = where.id?.notIn ?? [];
			return Promise.resolve(
				rows
					.filter(r => r.slug === null && !skip.includes(r.id))
					.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
					.slice(0, take)
					.map(r => ({ id: r.id, title: r.title })),
			);
		}
		return Promise.resolve(
			rows.filter(r => r.slug?.startsWith(slugWhere.startsWith)).map(r => ({ slug: r.slug })),
		);
	});
	const updateMany = jest.fn(
		({ where, data }: { where: { id: string; slug: null }; data: { slug: string } }) => {
			const row = rows.find(r => r.id === where.id && r.slug === null);
			if (!row) return Promise.resolve({ count: 0 });
			if (rows.some(r => r.slug === data.slug)) return Promise.reject(conflict());
			row.slug = data.slug;
			return Promise.resolve({ count: 1 });
		},
	);
	return { rows: rows, findMany: findMany, updateMany: updateMany };
};

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe('backfillSlugs', () => {
	it('fills only rows without a slug, oldest first, with the create-time rule', async () => {
		const blog = table([
			{ id: 'new', title: 'Viết email', slug: null, createdAt: day(3) },
			{ id: 'kept', title: 'Anything', slug: 'custom', createdAt: day(1) },
			{ id: 'old', title: 'Viết email', slug: null, createdAt: day(2) },
			{ id: 'blank', title: '???', slug: null, createdAt: day(4) },
		]);
		const forumThread = table([
			{ id: 't1', title: 'Chào mọi người', slug: null, createdAt: day(1) },
		]);

		const result = await backfillSlugs({ blog: blog, forumThread: forumThread } as never);

		const slugs = Object.fromEntries(blog.rows.map(r => [r.id, r.slug]));
		expect(slugs).toEqual({
			kept: 'custom',
			old: 'viet-email',
			new: 'viet-email-2',
			blank: 'bai-viet',
		});
		expect(forumThread.rows[0].slug).toBe('chao-moi-nguoi');
		expect(result.filled).toEqual({ blogs: 3, 'forum threads': 1 });
		expect(blog.updateMany).toHaveBeenCalledWith({
			where: { id: 'old', slug: null },
			data: { slug: 'viet-email' },
		});
	});

	it('does nothing when every row already has a slug (idempotent)', async () => {
		const blog = table([{ id: 'b', title: 'T', slug: 't', createdAt: day(1) }]);
		const forumThread = table([]);
		await backfillSlugs({ blog: blog, forumThread: forumThread } as never);
		await backfillSlugs({ blog: blog, forumThread: forumThread } as never);
		expect(blog.updateMany).not.toHaveBeenCalled();
	});

	it('recomputes the slug when another instance took it meanwhile (P2002)', async () => {
		const blog = table([{ id: 'b', title: 'Hello', slug: null, createdAt: day(1) }]);
		// another instance gives a different row "hello" between our lookup and our update
		blog.updateMany.mockImplementationOnce(() => {
			blog.rows.push({ id: 'other', title: 'Hello', slug: 'hello', createdAt: day(2) });
			return Promise.reject(conflict());
		});
		await backfillSlugs({ blog: blog, forumThread: table([]) } as never);
		expect(blog.rows.find(r => r.id === 'b')?.slug).toBe('hello-2');
	});

	it('leaves a row alone that another instance filled first', async () => {
		const blog = table([{ id: 'b', title: 'Hello', slug: null, createdAt: day(1) }]);
		const realUpdate = blog.updateMany.getMockImplementation();
		blog.updateMany.mockImplementationOnce(args => {
			blog.rows[0].slug = 'set-elsewhere';
			return realUpdate ? realUpdate(args) : Promise.resolve({ count: 0 });
		});
		await backfillSlugs({ blog: blog, forumThread: table([]) } as never);
		expect(blog.rows[0].slug).toBe('set-elsewhere');
		expect(await blog.updateMany.mock.results[0].value).toEqual({ count: 0 });
	});

	it('gives up on a row that keeps losing, without looping forever', async () => {
		const blog = table([{ id: 'b', title: 'Hello', slug: null, createdAt: day(1) }]);
		blog.updateMany.mockRejectedValue(conflict());
		const result = await backfillSlugs({ blog: blog, forumThread: table([]) } as never);
		expect(result.skipped.blogs).toBe(1);
		expect(blog.rows[0].slug).toBeNull();
	});

	it('propagates errors other than a slug conflict', async () => {
		const blog = table([{ id: 'b', title: 'Hello', slug: null, createdAt: day(1) }]);
		blog.updateMany.mockRejectedValue(new Error('db down'));
		await expect(backfillSlugs({ blog: blog, forumThread: table([]) } as never)).rejects.toThrow(
			'db down',
		);
	});
});
