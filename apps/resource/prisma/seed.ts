import { childPath } from '../src/domain/comments/comment-path';
import { SEED_BLOGS } from './seed/blogs';
import { DEMO_FLASHCARD_LISTS } from './seed/demo-flashcards';
import {
	SEED_BLOG_COMMENTS,
	SEED_FORUM_CATEGORIES,
	SEED_FORUM_THREADS,
	type SeedBlogComment,
} from './seed/forum';
import { SEED_USERS } from './seed/users';
import { PrismaClient } from '@prisma-client/resource';

const prisma = new PrismaClient();

const USER_IDS = [
	SEED_USERS.admin,
	SEED_USERS.minh,
	SEED_USERS.linh,
	SEED_USERS.duc,
	SEED_USERS.hoa,
	SEED_USERS.tuan,
];

const FLASHCARD_LISTS = [
	{
		name: 'Từ vựng giao tiếp hàng ngày',
		description: 'Những từ và cụm từ thông dụng trong giao tiếp hàng ngày',
		isPublic: true,
		tags: ['giao-tiep', 'co-ban'],
		cards: [
			{ word: 'Hello', definition: 'Xin chào', examples: ['Hello, how are you?'] },
			{ word: 'Goodbye', definition: 'Tạm biệt', examples: ['Goodbye, see you tomorrow!'] },
			{ word: 'Thank you', definition: 'Cảm ơn', examples: ['Thank you for your help.'] },
			{ word: 'Sorry', definition: 'Xin lỗi', examples: ['I am sorry for being late.'] },
			{ word: 'Please', definition: 'Làm ơn', examples: ['Please pass me the salt.'] },
		],
	},
	{
		name: 'Từ vựng về thời tiết',
		description: 'Các từ vựng miêu tả thời tiết bằng tiếng Anh',
		isPublic: true,
		tags: ['thoi-tiet', 'tu-vung'],
		cards: [
			{ word: 'Sunny', definition: 'Nắng', examples: ['It is a sunny day.'] },
			{ word: 'Rainy', definition: 'Mưa', examples: ['I love rainy days.'] },
			{ word: 'Cloudy', definition: 'Nhiều mây', examples: ['It looks cloudy outside.'] },
		],
	},
	{
		name: 'Động từ bất quy tắc',
		description: 'Các động từ bất quy tắc thường gặp',
		isPublic: false,
		tags: ['dong-tu', 'ngu-phap'],
		cards: [
			{ word: 'Go', definition: 'Đi (went - gone)', examples: ['I go to school every day.'] },
			{ word: 'Eat', definition: 'Ăn (ate - eaten)', examples: ['I ate breakfast at 7am.'] },
			{ word: 'Write', definition: 'Viết (wrote - written)', examples: ['She wrote a letter.'] },
		],
	},
];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Upserts the seeded posts: matched by seed id or (current/former) title, so re-runs update them. */
async function seedBlogs(): Promise<Map<string, string>> {
	const ids = new Map<string, string>();
	for (const [i, blog] of SEED_BLOGS.entries()) {
		const existing = await prisma.blog.findFirst({
			where: {
				OR: [{ id: blog.id }, { title: { in: [blog.title, ...(blog.formerTitles ?? [])] } }],
			},
			select: { id: true },
		});
		const data = { title: blog.title, content: blog.content, tags: blog.tags };
		if (existing) {
			await prisma.blog.update({ where: { id: existing.id }, data: data });
			ids.set(blog.id, existing.id);
		} else {
			await prisma.blog.create({
				data: {
					...data,
					id: blog.id,
					authorId: blog.authorId,
					createdAt: new Date(Date.now() - (SEED_BLOGS.length - i) * 3 * DAY),
				},
			});
			ids.set(blog.id, blog.id);
		}
	}
	console.warn(`Seeded ${SEED_BLOGS.length} blogs`);
	return ids;
}

/** Seeded comment trees; paths follow each comment's position among its seeded siblings. */
async function seedBlogComments(blogIds: Map<string, string>): Promise<void> {
	let count = 0;
	const upsert = async (
		blogId: string,
		comment: SeedBlogComment,
		parent: { id: string; rootId: string; path: string } | null,
		seq: number,
		createdAt: Date,
	): Promise<void> => {
		const path = parent ? childPath(parent.path, seq) : '';
		const rootId = parent ? parent.rootId : comment.id;
		const children = comment.replies ?? [];
		await prisma.blogComment.upsert({
			where: { id: comment.id },
			update: { content: comment.content },
			create: {
				id: comment.id,
				blogId: blogId,
				parentId: parent?.id ?? null,
				rootId: rootId,
				path: path,
				depth: path.length / 4,
				childSeq: children.length,
				authorId: comment.authorId,
				content: comment.content,
				createdAt: createdAt,
				updatedAt: createdAt,
			},
		});
		count++;
		for (const [i, child] of children.entries()) {
			await upsert(
				blogId,
				child,
				{ id: comment.id, rootId: rootId, path: path },
				i + 1,
				new Date(createdAt.getTime() + (i + 1) * 47 * MINUTE),
			);
		}
	};

	for (const [seedBlogId, comments] of Object.entries(SEED_BLOG_COMMENTS)) {
		const blogId = blogIds.get(seedBlogId);
		if (!blogId) continue;
		for (const [i, comment] of comments.entries()) {
			await upsert(blogId, comment, null, 0, new Date(Date.now() - (comments.length - i) * DAY));
		}
	}
	console.warn(`Seeded ${count} blog comments`);
}

async function seedForum(): Promise<void> {
	for (const category of SEED_FORUM_CATEGORIES) {
		const data = {
			name: category.name,
			description: category.description,
			position: category.position,
			moderatorsOnly: category.moderatorsOnly ?? false,
		};
		await prisma.forumCategory.upsert({
			where: { id: category.id },
			update: data,
			create: { ...data, id: category.id },
		});
	}

	let replyCount = 0;
	for (const thread of SEED_FORUM_THREADS) {
		const openedAt = new Date(Date.now() - thread.daysAgo * DAY);
		const content = {
			categoryId: thread.categoryId,
			title: thread.title,
			body: thread.body,
			isPinned: thread.isPinned ?? false,
			isLocked: thread.isLocked ?? false,
		};
		// Re-runs refresh the content but keep dates, views and counters that real use changed.
		await prisma.forumThread.upsert({
			where: { id: thread.id },
			update: content,
			create: {
				...content,
				id: thread.id,
				authorId: thread.authorId,
				viewCount: thread.viewCount,
				lastActivityAt: openedAt,
				createdAt: openedAt,
				updatedAt: openedAt,
			},
		});

		for (const reply of thread.replies) {
			const repliedAt = new Date(openedAt.getTime() + reply.after * MINUTE);
			await prisma.forumReply.upsert({
				where: { id: reply.id },
				update: { body: reply.body },
				create: {
					id: reply.id,
					threadId: thread.id,
					authorId: reply.authorId,
					body: reply.body,
					quotedReplyId: reply.quotes ?? null,
					createdAt: repliedAt,
					updatedAt: repliedAt,
				},
			});
			replyCount++;
		}

		// Counters from what is actually stored (users may have replied since the last seed).
		const [count, latest] = await Promise.all([
			prisma.forumReply.count({ where: { threadId: thread.id } }),
			prisma.forumReply.findFirst({
				where: { threadId: thread.id },
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				select: { authorId: true, createdAt: true },
			}),
		]);
		await prisma.forumThread.update({
			where: { id: thread.id },
			data: {
				replyCount: count,
				lastActivityAt: latest?.createdAt ?? openedAt,
				lastReplyAuthorId: latest?.authorId ?? null,
			},
		});
	}
	console.warn(
		`Seeded ${SEED_FORUM_CATEGORIES.length} forum categories, ${SEED_FORUM_THREADS.length} threads, ${replyCount} replies`,
	);
}

/**
 * The demo account's own lists, with fixed ids. Missing lists and cards are (re)created; ones that
 * exist are left as testers changed them.
 */
async function seedDemoFlashCards(): Promise<void> {
	for (const list of DEMO_FLASHCARD_LISTS) {
		const createdAt = new Date(Date.now() - list.daysAgo * DAY);
		await prisma.flashCardList.upsert({
			where: { id: list.id },
			update: {},
			create: {
				id: list.id,
				name: list.name,
				description: list.description,
				authorId: list.authorId,
				isPublic: list.isPublic,
				tags: list.tags,
				createdAt: createdAt,
				updatedAt: createdAt,
			},
		});
		for (const card of list.cards) {
			await prisma.flashCard.upsert({
				where: { id: card.id },
				update: {},
				create: {
					...card,
					authorId: list.authorId,
					listId: list.id,
					tags: [],
					createdAt: createdAt,
					updatedAt: createdAt,
				},
			});
		}
	}
	console.warn(`Seeded ${DEMO_FLASHCARD_LISTS.length} flashcard lists for the demo account`);
}

async function main() {
	const blogIds = await seedBlogs();
	await seedBlogComments(blogIds);
	await seedForum();

	// Seed flashcard lists with cards
	for (const list of FLASHCARD_LISTS) {
		if (await prisma.flashCardList.findFirst({ where: { name: list.name } })) {
			console.warn(`List "${list.name}" already exists, skipping`);
			continue;
		}
		const authorId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
		const created = await prisma.flashCardList.create({
			data: {
				name: list.name,
				description: list.description,
				authorId: authorId,
				isPublic: list.isPublic,
				tags: list.tags,
				cards: {
					create: list.cards.map(card => ({
						word: card.word,
						definition: card.definition,
						authorId: authorId,
						tags: [],
						examples: card.examples,
					})),
				},
			},
		});
		console.warn(`Created list "${created.name}" with ${list.cards.length} cards`);
	}

	console.warn(`Seeded ${FLASHCARD_LISTS.length} flashcard lists`);

	await seedDemoFlashCards();
}

main()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
