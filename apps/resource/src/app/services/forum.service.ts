import {
	type ForumCategoryListReadModel,
	type ForumCategoryReadModel,
	type ForumReplyListReadModel,
	type ForumReplyReadModel,
	type ForumThreadListReadModel,
	type ForumThreadReadModel,
	type ForumThreadSummaryReadModel,
} from '../../domain/read-models/forum.read-model';
import { toExcerpt } from '../../domain/text/excerpt';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	type CreateForumReplyInput,
	type CreateForumThreadInput,
	type ListForumRepliesInput,
	type ListForumThreadsInput,
	type ModerateForumThreadInput,
	type UpdateForumReplyInput,
	type UpdateForumThreadInput,
} from '../types/forum.input';
import { toSkipTake } from '../types/pagination';
import { type Requester } from '../types/requester';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import {
	ForumCategory,
	ForumReply,
	ForumThread,
	Prisma,
	PrismaClient,
} from '@prisma-client/resource';

type ThreadWithCategory = ForumThread & { category: Pick<ForumCategory, 'name'> };
type ReplyWithQuote = ForumReply & {
	quotedReply: Pick<ForumReply, 'id' | 'authorId' | 'body'> | null;
};

const withQuote = {
	quotedReply: { select: { id: true, authorId: true, body: true } },
} satisfies Prisma.ForumReplyInclude;

/** Thread lists: pinned first, then most recent activity. */
const threadOrder: Prisma.ForumThreadOrderByWithRelationInput[] = [
	{ isPinned: 'desc' },
	{ lastActivityAt: 'desc' },
	{ id: 'desc' },
];

/** Replies read oldest first; the id breaks ties so positions are stable. */
const replyOrder: Prisma.ForumReplyOrderByWithRelationInput[] = [
	{ createdAt: 'asc' },
	{ id: 'asc' },
];

const requireText = (value: string, field: string): string => {
	const trimmed = value.trim();
	if (!trimmed) throw new BadRequestException(`${field} must not be empty`);
	return trimmed;
};

/**
 * Forum: seeded categories, threads, flat replies (optionally quoting another reply).
 *
 * Rules, decided here from the requester the gateway forwards (`privileged` = forum moderator):
 * - only the author edits a thread/reply; the author or a moderator deletes it. Anyone else gets
 *   404, as if it did not exist;
 * - only moderators pin/lock, open threads in `moderatorsOnly` categories, and write in (reply to,
 *   edit inside) a locked thread.
 */
@Injectable()
export class ForumService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
	) {}

	private toSummary(thread: ForumThread): ForumThreadSummaryReadModel {
		return {
			id: thread.id,
			categoryId: thread.categoryId,
			authorId: thread.authorId,
			title: thread.title,
			excerpt: toExcerpt(thread.body),
			isPinned: thread.isPinned,
			isLocked: thread.isLocked,
			replyCount: thread.replyCount,
			viewCount: thread.viewCount,
			lastActivityAt: thread.lastActivityAt.toISOString(),
			lastReplyAuthorId: thread.lastReplyAuthorId ?? undefined,
			createdAt: thread.createdAt.toISOString(),
			updatedAt: thread.updatedAt.toISOString(),
		};
	}

	private toThread(thread: ThreadWithCategory): ForumThreadReadModel {
		return {
			id: thread.id,
			categoryId: thread.categoryId,
			categoryName: thread.category.name,
			authorId: thread.authorId,
			title: thread.title,
			body: thread.body,
			isPinned: thread.isPinned,
			isLocked: thread.isLocked,
			replyCount: thread.replyCount,
			viewCount: thread.viewCount,
			lastActivityAt: thread.lastActivityAt.toISOString(),
			lastReplyAuthorId: thread.lastReplyAuthorId ?? undefined,
			editedAt: thread.editedAt?.toISOString(),
			createdAt: thread.createdAt.toISOString(),
			updatedAt: thread.updatedAt.toISOString(),
		};
	}

	private toReply(reply: ReplyWithQuote, position: number): ForumReplyReadModel {
		return {
			id: reply.id,
			threadId: reply.threadId,
			authorId: reply.authorId,
			body: reply.body,
			position: position,
			quotedReply:
				reply.quotedReply ?
					{
						id: reply.quotedReply.id,
						authorId: reply.quotedReply.authorId,
						excerpt: toExcerpt(reply.quotedReply.body, 200),
					}
				:	undefined,
			editedAt: reply.editedAt?.toISOString(),
			createdAt: reply.createdAt.toISOString(),
			updatedAt: reply.updatedAt.toISOString(),
		};
	}

	/** 1-based position of a reply in its thread, in `replyOrder`. */
	private async positionOf(reply: ForumReply): Promise<number> {
		const before = await this.txHost.tx.forumReply.count({
			where: {
				threadId: reply.threadId,
				OR: [
					{ createdAt: { lt: reply.createdAt } },
					{ createdAt: reply.createdAt, id: { lt: reply.id } },
				],
			},
		});
		return before + 1;
	}

	private async findThread(id: string): Promise<ForumThread> {
		const thread = await this.txHost.tx.forumThread.findUnique({ where: { id: id } });
		if (!thread) throw new NotFoundException('Thread not found');
		return thread;
	}

	/** The author's own thread (edit). */
	private async findOwnThread(id: string, requester: Requester): Promise<ForumThread> {
		const thread = await this.findThread(id);
		if (thread.authorId !== requester.id) throw new NotFoundException('Thread not found');
		return thread;
	}

	private async findReply(id: string): Promise<ForumReply & { thread: ForumThread }> {
		const reply = await this.txHost.tx.forumReply.findUnique({
			where: { id: id },
			include: { thread: true },
		});
		if (!reply) throw new NotFoundException('Reply not found');
		return reply;
	}

	private assertWritable(thread: ForumThread, requester: Requester): void {
		if (thread.isLocked && !requester.privileged) {
			throw new ForbiddenException('This thread is locked');
		}
	}

	// ── Categories ───────────────────────────────────────────────────────────

	async listCategories(): Promise<ForumCategoryListReadModel> {
		const categories = await this.txHost.tx.forumCategory.findMany({
			orderBy: [{ position: 'asc' }, { name: 'asc' }],
		});
		return { categories: await this.withStats(categories) };
	}

	async getCategory(id: string): Promise<ForumCategoryReadModel> {
		const category = await this.txHost.tx.forumCategory.findUnique({ where: { id: id } });
		if (!category) throw new NotFoundException('Category not found');
		const [withStats] = await this.withStats([category]);
		return withStats;
	}

	/** Thread/reply totals per category in one grouped query, plus each one's most active thread. */
	private async withStats(categories: ForumCategory[]): Promise<ForumCategoryReadModel[]> {
		if (categories.length === 0) return [];
		const ids = categories.map(c => c.id);
		const [totals, latest] = await Promise.all([
			this.txHost.tx.forumThread.groupBy({
				by: ['categoryId'],
				where: { categoryId: { in: ids } },
				_count: { _all: true },
				_sum: { replyCount: true },
			}),
			Promise.all(
				ids.map(id =>
					this.txHost.tx.forumThread.findFirst({
						where: { categoryId: id },
						orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
					}),
				),
			),
		]);
		const totalsById = new Map(totals.map(t => [t.categoryId, t]));
		return categories.map((category, i) => {
			const total = totalsById.get(category.id);
			const thread = latest[i];
			return {
				id: category.id,
				name: category.name,
				description: category.description,
				position: category.position,
				moderatorsOnly: category.moderatorsOnly,
				threadCount: total?._count._all ?? 0,
				replyCount: total?._sum.replyCount ?? 0,
				latestThread: thread ? this.toSummary(thread) : undefined,
			};
		});
	}

	// ── Threads ──────────────────────────────────────────────────────────────

	async listThreads(data: ListForumThreadsInput): Promise<ForumThreadListReadModel> {
		const category = await this.txHost.tx.forumCategory.findUnique({
			where: { id: data.categoryId },
		});
		if (!category) throw new NotFoundException('Category not found');

		const search = data.search?.trim();
		const where: Prisma.ForumThreadWhereInput = {
			categoryId: data.categoryId,
			...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
		};
		const [threads, totalCount] = await Promise.all([
			this.txHost.tx.forumThread.findMany({
				where: where,
				orderBy: threadOrder,
				...toSkipTake(data),
			}),
			this.txHost.tx.forumThread.count({ where: where }),
		]);
		return { threads: threads.map(t => this.toSummary(t)), totalCount: totalCount };
	}

	async createThread(
		data: CreateForumThreadInput,
		requester: Requester,
	): Promise<ForumThreadReadModel> {
		const category = await this.txHost.tx.forumCategory.findUnique({
			where: { id: data.categoryId },
		});
		if (!category) throw new NotFoundException('Category not found');
		if (category.moderatorsOnly && !requester.privileged) {
			throw new ForbiddenException('Only moderators can open threads in this category');
		}

		const created = await this.txHost.tx.forumThread.create({
			data: {
				categoryId: category.id,
				authorId: requester.id,
				title: requireText(data.title, 'title'),
				body: requireText(data.body, 'body'),
			},
			include: { category: { select: { name: true } } },
		});
		return this.toThread(created);
	}

	/** Reading a thread counts a view. */
	async getThread(id: string): Promise<ForumThreadReadModel> {
		await this.findThread(id);
		const thread = await this.txHost.tx.forumThread.update({
			where: { id: id },
			data: { viewCount: { increment: 1 } },
			include: { category: { select: { name: true } } },
		});
		return this.toThread(thread);
	}

	async updateThread(
		data: UpdateForumThreadInput,
		requester: Requester,
	): Promise<ForumThreadReadModel> {
		const thread = await this.findOwnThread(data.id, requester);
		this.assertWritable(thread, requester);
		if (data.title === undefined && data.body === undefined) {
			throw new BadRequestException('Nothing to update');
		}

		const updated = await this.txHost.tx.forumThread.update({
			where: { id: thread.id },
			data: {
				title: data.title === undefined ? undefined : requireText(data.title, 'title'),
				body: data.body === undefined ? undefined : requireText(data.body, 'body'),
				editedAt: new Date(),
			},
			include: { category: { select: { name: true } } },
		});
		return this.toThread(updated);
	}

	async moderateThread(
		data: ModerateForumThreadInput,
		requester: Requester,
	): Promise<ForumThreadReadModel> {
		if (!requester.privileged) throw new ForbiddenException('Only moderators can do this');
		const thread = await this.findThread(data.id);
		const updated = await this.txHost.tx.forumThread.update({
			where: { id: thread.id },
			data: { isPinned: data.isPinned, isLocked: data.isLocked },
			include: { category: { select: { name: true } } },
		});
		return this.toThread(updated);
	}

	/** Deletes the thread and (cascade) its replies. */
	async deleteThread(id: string, requester: Requester): Promise<void> {
		const thread = await this.findThread(id);
		if (thread.authorId !== requester.id && !requester.privileged) {
			throw new NotFoundException('Thread not found');
		}
		await this.txHost.tx.forumThread.delete({ where: { id: thread.id } });
	}

	// ── Replies ──────────────────────────────────────────────────────────────

	async listReplies(data: ListForumRepliesInput): Promise<ForumReplyListReadModel> {
		await this.findThread(data.threadId);
		const { skip, take } = toSkipTake(data);
		const where: Prisma.ForumReplyWhereInput = { threadId: data.threadId };
		const [replies, totalCount] = await Promise.all([
			this.txHost.tx.forumReply.findMany({
				where: where,
				include: withQuote,
				orderBy: replyOrder,
				skip: skip,
				take: take,
			}),
			this.txHost.tx.forumReply.count({ where: where }),
		]);
		return {
			replies: replies.map((r, i) => this.toReply(r, skip + i + 1)),
			totalCount: totalCount,
		};
	}

	/** Adds a reply and bumps the thread's reply count and last activity. */
	@Transactional()
	async createReply(
		data: CreateForumReplyInput,
		requester: Requester,
	): Promise<ForumReplyReadModel> {
		const thread = await this.findThread(data.threadId);
		this.assertWritable(thread, requester);
		let quotedAuthorId: string | null = null;
		if (data.quotedReplyId) {
			const quoted = await this.txHost.tx.forumReply.findFirst({
				where: { id: data.quotedReplyId, threadId: thread.id },
				select: { id: true, authorId: true },
			});
			if (!quoted) throw new NotFoundException('Quoted reply not found');
			quotedAuthorId = quoted.authorId;
		}

		const created = await this.txHost.tx.forumReply.create({
			data: {
				threadId: thread.id,
				authorId: requester.id,
				body: requireText(data.body, 'body'),
				quotedReplyId: data.quotedReplyId ?? null,
			},
			include: withQuote,
		});
		await this.txHost.tx.forumThread.update({
			where: { id: thread.id },
			data: {
				replyCount: { increment: 1 },
				lastActivityAt: created.createdAt,
				lastReplyAuthorId: requester.id,
			},
		});
		const position = await this.positionOf(created);
		await this.events.forumReplyCreated({
			replyId: created.id,
			threadId: thread.id,
			threadTitle: thread.title,
			threadAuthorId: thread.authorId,
			authorId: requester.id,
			quotedAuthorId: quotedAuthorId,
			excerpt: toExcerpt(created.body, 120),
			position: position,
		});
		return this.toReply(created, position);
	}

	async updateReply(
		data: UpdateForumReplyInput,
		requester: Requester,
	): Promise<ForumReplyReadModel> {
		const reply = await this.findReply(data.id);
		if (reply.authorId !== requester.id) throw new NotFoundException('Reply not found');
		this.assertWritable(reply.thread, requester);

		const updated = await this.txHost.tx.forumReply.update({
			where: { id: reply.id },
			data: { body: requireText(data.body, 'body'), editedAt: new Date() },
			include: withQuote,
		});
		return this.toReply(updated, await this.positionOf(updated));
	}

	/** Deletes a reply; the thread's counters and last activity are recomputed from what remains. */
	@Transactional()
	async deleteReply(id: string, requester: Requester): Promise<void> {
		const reply = await this.findReply(id);
		if (reply.authorId !== requester.id && !requester.privileged) {
			throw new NotFoundException('Reply not found');
		}

		await this.txHost.tx.forumReply.delete({ where: { id: reply.id } });
		// Sequential: these share one interactive transaction.
		const remaining = await this.txHost.tx.forumReply.count({
			where: { threadId: reply.threadId },
		});
		const latest = await this.txHost.tx.forumReply.findFirst({
			where: { threadId: reply.threadId },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { authorId: true, createdAt: true },
		});
		await this.txHost.tx.forumThread.update({
			where: { id: reply.threadId },
			data: {
				replyCount: remaining,
				lastActivityAt: latest?.createdAt ?? reply.thread.createdAt,
				lastReplyAuthorId: latest?.authorId ?? null,
			},
		});
	}
}
