import { buildCommentTree } from '../../../domain/comments/comment-tree';

const row = (
	id: string,
	parentId: string | null,
	rootId: string,
	path: string,
	deleted = false,
) => ({
	id: id,
	parentId: parentId,
	rootId: rootId,
	path: path,
	deleted: deleted,
});

const ids = (nodes: { id: string; replies: unknown[] }[]): unknown =>
	nodes.map(n => (n.replies.length ? { [n.id]: ids(n.replies as never) } : n.id));

describe('buildCommentTree', () => {
	it('nests replies under their parents in path order, roots in the given order', () => {
		const rows = [
			row('b2', 'b', 'b', '0002'),
			row('a1x', 'a1', 'a', '00010001'),
			row('a', null, 'a', ''),
			row('b', null, 'b', ''),
			row('a2', 'a', 'a', '0002'),
			row('a1', 'a', 'a', '0001'),
			row('b1', 'b', 'b', '0001'),
		];
		expect(ids(buildCommentTree(rows, ['b', 'a']))).toEqual([
			{ b: ['b1', 'b2'] },
			{ a: [{ a1: ['a1x'] }, 'a2'] },
		]);
	});

	it('keeps a deleted comment that still has replies', () => {
		const tree = buildCommentTree(
			[row('a', null, 'a', '', true), row('a1', 'a', 'a', '0001')],
			['a'],
		);
		expect(ids(tree)).toEqual([{ a: ['a1'] }]);
		expect(tree[0].deleted).toBe(true);
	});

	it('prunes deleted leaves, including chains that end up empty', () => {
		const tree = buildCommentTree(
			[
				row('a', null, 'a', ''),
				row('a1', 'a', 'a', '0001', true),
				row('a1x', 'a1', 'a', '00010001', true),
				row('a2', 'a', 'a', '0002'),
				row('b', null, 'b', '', true),
			],
			['a', 'b'],
		);
		expect(ids(tree)).toEqual([{ a: ['a2'] }]);
	});

	it('ignores unknown roots, non-root ids and orphans', () => {
		const tree = buildCommentTree(
			[row('a', null, 'a', ''), row('a1', 'a', 'a', '0001'), row('o', 'gone', 'a', '0009')],
			['missing', 'a1', 'a'],
		);
		expect(ids(tree)).toEqual([{ a: ['a1'] }]);
	});
});
