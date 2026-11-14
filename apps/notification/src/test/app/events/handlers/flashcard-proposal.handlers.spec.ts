import { FlashCardProposalCreatedHandler } from '../../../../app/events/handlers/flashcard-proposal-created.handler';
import {
	FlashCardProposalDecidedHandler,
	proposalDecisionText,
} from '../../../../app/events/handlers/flashcard-proposal-decided.handler';
import { FlashCardProposalStatus } from '@server/typing';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('nestjs-cls', () => ({ UseCls: () => () => undefined }));

const event = (type: string, payload: object) => ({ id: 'evt-1', type: type, payload: payload });

const setup = (claimed = true) => {
	const notifications = {
		createNotification: jest.fn((n: object) => Promise.resolve(n)),
		push: jest.fn(),
	};
	const inbox = { claim: jest.fn().mockResolvedValue(claimed) };
	return {
		notifications: notifications,
		created: new FlashCardProposalCreatedHandler(notifications as never, inbox as never),
		decided: new FlashCardProposalDecidedHandler(notifications as never, inbox as never),
	};
};

const proposal = {
	proposalId: 'p1',
	targetListId: 'l1',
	targetListName: 'IELTS',
	title: 'Sửa nghĩa',
};

const firstNotification = (mock: jest.Mock) =>
	(
		mock.mock.calls as [{ recipientId: string; title: string; message: string; data: string }][]
	)[0][0];

describe('flash card proposal notifications', () => {
	it('tells the list owner about a new proposal, with a link to it', async () => {
		const { created, notifications } = setup();
		await created.handle(
			event('resource.flashcard-proposal.created', {
				...proposal,
				targetOwnerId: 'owner',
				authorId: 'proposer',
			}),
		);
		const n = firstNotification(notifications.createNotification);
		expect(n).toMatchObject({
			recipientId: 'owner',
			type: 'flashcard',
			title: 'Có đề xuất thay đổi cho bộ thẻ của bạn',
		});
		expect(JSON.parse(n.data)).toMatchObject({ action: '/flashcards/l1/proposals/p1' });
	});

	it('tells the proposer about the decision, with the owner’s note', async () => {
		const { decided, notifications } = setup();
		await decided.handle(
			event('resource.flashcard-proposal.decided', {
				...proposal,
				authorId: 'proposer',
				status: 'REJECTED',
				decidedBy: 'owner',
				decisionNote: 'Chưa phù hợp',
			}),
		);
		const n = firstNotification(notifications.createNotification);
		expect(n.recipientId).toBe('proposer');
		expect(n.title).toBe('Đề xuất của bạn đã bị từ chối');
		expect(n.message).toContain('Ghi chú: Chưa phù hợp');
	});

	it('skips redeliveries and decisions by the proposer themself', async () => {
		const redelivered = setup(false);
		await redelivered.created.handle(
			event('x', { ...proposal, targetOwnerId: 'owner', authorId: 'proposer' }),
		);
		expect(redelivered.notifications.createNotification).not.toHaveBeenCalled();

		const self = setup();
		await self.decided.handle(
			event('x', {
				...proposal,
				authorId: 'admin',
				status: 'ACCEPTED',
				decidedBy: 'admin',
				decisionNote: null,
			}),
		);
		expect(self.notifications.createNotification).not.toHaveBeenCalled();
	});

	it('rejects malformed events so they are retried and dead-lettered', async () => {
		const { decided } = setup();
		await expect(decided.handle(event('x', { ...proposal, status: 'MERGED' }))).rejects.toThrow();
	});

	it('words accepted proposals and ignores other statuses', () => {
		expect(proposalDecisionText({ ...proposal, status: FlashCardProposalStatus.Accepted })).toEqual(
			{
				title: 'Đề xuất của bạn đã được chấp nhận',
				message: 'Đề xuất "Sửa nghĩa" cho bộ thẻ "IELTS" đã được chấp nhận và áp dụng.',
			},
		);
		expect(
			proposalDecisionText({ ...proposal, status: FlashCardProposalStatus.Withdrawn }),
		).toBeNull();
	});
});
