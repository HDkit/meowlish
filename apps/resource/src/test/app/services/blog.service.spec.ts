import { BlogService } from '../../../app/services/blog.service';

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
