import { comparePaths } from './comment-path';

export interface CommentRow {
	id: string;
	parentId: string | null;
	rootId: string;
	path: string;
	deleted: boolean;
}

export type CommentNode<T extends CommentRow> = T & { replies: CommentNode<T>[] };

/**
 * Turns the flat rows of some threads into trees: roots in `rootIds` order, every level in path
 * order (oldest first). Rows whose parent is missing are dropped, and deleted comments without any
 * remaining replies are pruned, so "[deleted]" placeholders appear only where they hold a thread.
 */
export const buildCommentTree = <T extends CommentRow>(
	rows: readonly T[],
	rootIds: readonly string[],
): CommentNode<T>[] => {
	const nodes = new Map<string, CommentNode<T>>();
	const sorted = [...rows].sort((a, b) => comparePaths(a.path, b.path));
	for (const row of sorted) nodes.set(row.id, { ...row, replies: [] });

	for (const row of sorted) {
		if (row.parentId === null) continue;
		const node = nodes.get(row.id);
		const parent = nodes.get(row.parentId);
		if (node && parent) parent.replies.push(node);
	}

	const prune = (node: CommentNode<T>): CommentNode<T> | null => {
		const replies = node.replies.map(prune).filter((r): r is CommentNode<T> => r !== null);
		if (node.deleted && replies.length === 0) return null;
		return { ...node, replies: replies };
	};

	return rootIds
		.map(id => nodes.get(id))
		.filter((n): n is CommentNode<T> => n !== undefined && n.parentId === null)
		.map(prune)
		.filter((n): n is CommentNode<T> => n !== null);
};
