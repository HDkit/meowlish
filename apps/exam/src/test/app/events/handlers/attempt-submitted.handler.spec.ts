import { AttemptSubmittedHandler } from '../../../../app/events/handlers/attempt-submitted.handler';
import { createEnvelope } from '@server/messaging';

jest.mock('@nestjs-cls/transactional', () => ({
	...jest.requireActual<object>('@nestjs-cls/transactional'),
	Transactional: () => () => undefined,
}));
jest.mock('nestjs-cls', () => ({
	...jest.requireActual<object>('nestjs-cls'),
	UseCls: () => () => undefined,
}));

const setup = (claimed = true) => {
	const attempt = {
		evaluateScore: jest.fn(),
		getUncommittedEvents: jest.fn().mockReturnValue(['scored-event']),
	};
	const repo = {
		getScoreEvaluator: jest.fn().mockResolvedValue(attempt),
		save: jest.fn().mockResolvedValue(undefined),
	};
	const scored = { publish: jest.fn().mockResolvedValue(undefined) };
	const writing = { publish: jest.fn().mockResolvedValue(undefined) };
	const inbox = { claim: jest.fn().mockResolvedValue(claimed) };
	const handler = new AttemptSubmittedHandler(
		repo as never,
		scored as never,
		writing as never,
		inbox as never,
	);
	return {
		attempt: attempt,
		repo: repo,
		scored: scored,
		writing: writing,
		inbox: inbox,
		handler: handler,
	};
};

const event = () =>
	createEnvelope('exam.attempt.submitted', { attemptId: 'a1', attemptedBy: 'u1' });

describe('AttemptSubmittedHandler (durable scoring)', () => {
	it('claims the event, scores the attempt and writes its events', async () => {
		const ctx = setup();
		const e = event();
		await ctx.handler.handle(e);
		expect(ctx.inbox.claim).toHaveBeenCalledWith(e.id, 'exam.events.attempt.submitted');
		expect(ctx.attempt.evaluateScore).toHaveBeenCalled();
		expect(ctx.repo.save).toHaveBeenCalledWith(ctx.attempt);
		expect(ctx.scored.publish).toHaveBeenCalledWith(['scored-event']);
		expect(ctx.writing.publish).toHaveBeenCalledWith(['scored-event']);
	});

	it('skips a redelivered event', async () => {
		const ctx = setup(false);
		await ctx.handler.handle(event());
		expect(ctx.repo.getScoreEvaluator).not.toHaveBeenCalled();
		expect(ctx.scored.publish).not.toHaveBeenCalled();
	});

	it('lets a failure propagate so the broker retries it (nothing is swallowed)', async () => {
		const ctx = setup();
		ctx.repo.save.mockRejectedValue(new Error('db down'));
		await expect(ctx.handler.handle(event())).rejects.toThrow('db down');
		expect(ctx.scored.publish).not.toHaveBeenCalled();
	});
});
