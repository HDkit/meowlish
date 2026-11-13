import { MAX_COMMENT_DEPTH, childPath, depthOf } from '../../domain/comments/comment-path';
import { type CommentNode, buildCommentTree } from '../../domain/comments/comment-tree';
import {
	type BlogCommentListReadModel,
	type BlogCommentReadModel,
} from '../../domain/read-models/blog-comment.read-model';
import {
	type CreateBlogCommentInput,
	type ListBlogCommentsInput,
	type UpdateBlogCommentInput,
} from '../types/blog-comment.input';
import { toSkipTake } from '../types/pagination';
import { type Requester } from '../types/requester';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BlogComment, PrismaClient } from '@prisma-client/resource';
import { randomUUID } from 'node:crypto';

type CommentTreeNode = CommentNode<BlogComment & { deleted: boolean }>;

const requireContent = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) throw new BadRequestException('content must not be empty');
	return trimmed;
};

/**
 * Nested comments under blog posts, stored as materialized paths (see `comment-path.ts` for the
 * choice). Only the author edits a comment; the author or a moderator (`privileged`) deletes it.
 * Anyone else gets 404. A deleted comment that still has replies stays as a "[deleted]"
 * placeholder (content and author cleared); otherwise the row goes, along with any placeholder
 * ancestors it was the last reply of.
 */
@Injectable()
export class BlogCommentService {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	private toReadModel(node: CommentTreeNode): BlogCommentReadModel {
		return {
			id: node.id,
			blogId: node.blogId,
			parentId: node.parentId ?? undefined,
			authorId: node.deleted ? '' : node.authorId,
			content: node.deleted ? '' : node.content,
			depth: node.depth,
			deleted: node.deleted,
			editedAt: node.deleted ? undefined : node.editedAt?.toISOString(),
			createdAt: node.createdAt.toISOString(),
			updatedAt: node.updatedAt.toISOString(),
			replies: node.replies.map(r => this.toReadModel(r)),
		};
	}

	private single(comment: BlogComment): BlogCommentReadModel {
		return this.toReadModel({ ...comment, deleted: comment.deletedAt !== null, replies: [] });
	}

	private async assertBlogExists(blogId: string): Promise<void> {
		const blog = await this.txHost.tx.blog.findUnique({
			where: { id: blogId },
			select: { id: true },
		});
		if (!blog) throw new NotFoundException('Blog not found');
	}

	private async findLiveComment(id: string): Promise<BlogComment> {
		const comment = await this.txHost.tx.blogComment.findUnique({ where: { id: id } });
		if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
		return comment;
	}

	/** A page of top-level comments (newest first), each with its full reply tree. */
	async listComments(data: ListBlogCommentsInput): Promise<BlogCommentListReadModel> {
		await this.assertBlogExists(data.blogId);
		const rootWhere = { blogId: data.blogId, parentId: null };
		const [roots, totalThreads, totalComments] = await Promise.all([
			this.txHost.tx.blogComment.findMany({
				where: rootWhere,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: { id: true },
				...toSkipTake(data),
			}),
			this.txHost.tx.blogComment.count({ where: rootWhere }),
			this.txHost.tx.blogComment.count({ where: { blogId: data.blogId, deletedAt: null } }),
		]);
		const rootIds = roots.map(r => r.id);
		const rows =
			rootIds.length > 0 ?
				await this.txHost.tx.blogComment.findMany({ where: { rootId: { in: rootIds } } })
			:	[];
		const tree = buildCommentTree(
			rows.map(r => ({ ...r, deleted: r.deletedAt !== null })),
			rootIds,
		);
		return {
			comments: tree.map(n => this.toReadModel(n)),
			totalThreads: totalThreads,
			totalComments: totalComments,
		};
	}

	/**
	 * Adds a top-level comment or a reply. A reply below `MAX_COMMENT_DEPTH` is stored next to its
	 * parent instead (same thread, one level up), so paths stay short and the UI stays readable.
	 */
	@Transactional()
	async createComment(
		data: CreateBlogCommentInput,
		requester: Requester,
	): Promise<BlogCommentReadModel> {
		await this.assertBlogExists(data.blogId);
		const content = requireContent(data.content);
		const id = randomUUID();

		if (!data.parentId) {
			const created = await this.txHost.tx.blogComment.create({
				data: {
					id: id,
					blogId: data.blogId,
					parentId: null,
					rootId: id,
					path: '',
					depth: 0,
					authorId: requester.id,
					content: content,
				},
			});
			return this.single(created);
		}

		let parent = await this.findLiveComment(data.parentId);
		if (parent.blogId !== data.blogId) throw new NotFoundException('Comment not found');
		if (parent.depth >= MAX_COMMENT_DEPTH && parent.parentId) {
			parent = await this.txHost.tx.blogComment.findUniqueOrThrow({
				where: { id: parent.parentId },
			});
		}

		// Row-locks the parent and hands out its next segment, so concurrent replies never collide.
		const { childSeq } = await this.txHost.tx.blogComment.update({
			where: { id: parent.id },
			data: { childSeq: { increment: 1 } },
			select: { childSeq: true },
		});
		const path = childPath(parent.path, childSeq);
		const created = await this.txHost.tx.blogComment.create({
			data: {
				id: id,
				blogId: parent.blogId,
				parentId: parent.id,
				rootId: parent.rootId,
				path: path,
				depth: depthOf(path),
				authorId: requester.id,
				content: content,
			},
		});
		return this.single(created);
	}

	async updateComment(
		data: UpdateBlogCommentInput,
		requester: Requester,
	): Promise<BlogCommentReadModel> {
		const comment = await this.findLiveComment(data.id);
		if (comment.authorId !== requester.id) throw new NotFoundException('Comment not found');
		const updated = await this.txHost.tx.blogComment.update({
			where: { id: comment.id },
			data: { content: requireContent(data.content), editedAt: new Date() },
		});
		return this.single(updated);
	}

	@Transactional()
	async deleteComment(id: string, requester: Requester): Promise<void> {
		const comment = await this.findLiveComment(id);
		if (comment.authorId !== requester.id && !requester.privileged) {
			throw new NotFoundException('Comment not found');
		}

		if ((await this.countReplies(comment.id)) > 0) {
			await this.txHost.tx.blogComment.update({
				where: { id: comment.id },
				data: { deletedAt: new Date(), content: '' },
			});
			return;
		}

		await this.txHost.tx.blogComment.delete({ where: { id: comment.id } });
		// Placeholders exist only to hold replies: drop the ones this was the last reply of.
		let parentId = comment.parentId;
		while (parentId) {
			const parent = await this.txHost.tx.blogComment.findUnique({ where: { id: parentId } });
			if (!parent?.deletedAt || (await this.countReplies(parent.id)) > 0) break;
			await this.txHost.tx.blogComment.delete({ where: { id: parent.id } });
			parentId = parent.parentId;
		}
	}

	private countReplies(id: string): Promise<number> {
		return this.txHost.tx.blogComment.count({ where: { parentId: id } });
	}
}
