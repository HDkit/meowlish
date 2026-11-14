import { BlogCommentCreatedHandler, blogCommentAction } from './blog-comment-created.handler';
import { discussionRecipients } from './discussion-recipients';
import { ForumReplyCreatedHandler, forumReplyAction } from './forum-reply-created.handler';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('nestjs-cls', () => ({ UseCls: () => () => undefined }));

const event = (payload: object) => ({ id: 'evt-1', type: 'x', payload: payload });

const deps = (opts: { disabled?: string[]; claimed?: boolean } = {}) => ({
	notifications: { createNotification: jest.fn() },
	preferences: {
		isEnabled: jest.fn((id: string) => Promise.resolve(!(opts.disabled ?? []).includes(id))),
	},
	inbox: { claim: jest.fn().mockResolvedValue(opts.claimed ?? true) },
});

const sent = (d: ReturnType<typeof deps>) =>
	(d.notifications.createNotification.mock.calls as [{ recipientId: string; type: string }][]).map(
		([n]) => `${n.recipientId}:${n.type}`,
	);

describe('discussionRecipients', () => {
	const owner = { id: 'owner', preference: 'blogComment' } as const;
	it('tells the replied-to author and the owner, never the writer', () => {
		expect(discussionRecipients('me', owner, { id: 'other', preference: 'commentReply' })).toEqual([
			{ id: 'other', preference: 'commentReply', kind: 'replied' },
			{ id: 'owner', preference: 'blogComment', kind: 'owner' },
		]);
		expect(discussionRecipients('owner', owner, { id: null, preference: 'commentReply' })).toEqual(
			[],
		);
		expect(discussionRecipients('me', owner, { id: 'me', preference: 'commentReply' })).toEqual([
			{ id: 'owner', preference: 'blogComment', kind: 'owner' },
		]);
	});

	it('sends one notification to an owner who was also replied to', () => {
		expect(discussionRecipients('me', owner, { id: 'owner', preference: 'commentReply' })).toEqual([
			{ id: 'owner', preference: 'commentReply', kind: 'replied' },
		]);
	});
});

describe('BlogCommentCreatedHandler', () => {
	const comment = {
		commentId: 'c1',
		blogId: 'b1',
		blogTitle: 'Mẹo IELTS',
		blogAuthorId: 'writer',
		authorId: 'me',
		parentAuthorId: 'other',
		excerpt: 'Hay quá',
	};
	const run = async (payload: object, opts?: Parameters<typeof deps>[0]) => {
		const d = deps(opts);
		await new BlogCommentCreatedHandler(
			d.notifications as never,
			d.preferences as never,
			d.inbox as never,
		).handle(event(payload));
		return d;
	};

	it('notifies the replied-to author and the post author with a link to the comment', async () => {
		const d = await run(comment);
		expect(sent(d)).toEqual(['other:comment_reply', 'writer:blog_comment']);
		expect(d.preferences.isEnabled.mock.calls).toEqual([
			['other', 'commentReply'],
			['writer', 'blogComment'],
		]);
		const [[first]] = d.notifications.createNotification.mock.calls as [
			{ data: string; message: string },
		][];
		expect(JSON.parse(first.data)).toMatchObject({ action: '/blog/b1#comment-c1' });
		expect(first.message).toBe('Trong bài "Mẹo IELTS": Hay quá');
	});

	it('respects opt-outs and skips redeliveries', async () => {
		expect(sent(await run(comment, { disabled: ['writer'] }))).toEqual(['other:comment_reply']);
		expect(sent(await run({ ...comment, parentAuthorId: null }))).toEqual(['writer:blog_comment']);
		expect(sent(await run(comment, { claimed: false }))).toEqual([]);
	});
});

describe('ForumReplyCreatedHandler', () => {
	const reply = {
		replyId: 'r1',
		threadId: 't1',
		threadTitle: 'Task 2',
		threadAuthorId: 'starter',
		authorId: 'me',
		quotedAuthorId: null,
		excerpt: 'Đồng ý',
		position: 41,
	};
	it('notifies the thread author, linking to the page of the reply', async () => {
		const d = deps();
		await new ForumReplyCreatedHandler(
			d.notifications as never,
			d.preferences as never,
			d.inbox as never,
		).handle(event(reply));
		expect(sent(d)).toEqual(['starter:forum_reply']);
		expect(d.preferences.isEnabled).toHaveBeenCalledWith('starter', 'forumReply');
		const [[n]] = d.notifications.createNotification.mock.calls as [{ data: string }][];
		expect(JSON.parse(n.data)).toMatchObject({ action: '/forum/thread/t1?page=3#reply-r1' });
	});

	it('builds first-page links without a page number', () => {
		expect(forumReplyAction('t1', 'r1', 20)).toBe('/forum/thread/t1#reply-r1');
		expect(blogCommentAction('b 1', 'c1')).toBe('/blog/b%201#comment-c1');
	});
});
