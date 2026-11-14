import { BlogService } from './blog.service';

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
