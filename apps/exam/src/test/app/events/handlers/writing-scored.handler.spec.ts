import {
	WritingScoredEvent,
	WritingScoredHandler,
} from '../../../../app/events/handlers/writing-scored.handler';
import {
	AttemptEvaluator,
	AttemptQuestion,
	AttemptResponseResult,
} from '../../../../domain/entities/attempt-evaluator.entity';
import { AttemptVersionConflictException } from '../../../../domain/repositories/attempt.repository';
import { QuestionType } from '../../../../enums/question-type.enum';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));
jest.mock('nestjs-cls', () => ({ UseCls: () => () => undefined }));

const evaluator = () =>
	new AttemptEvaluator({
		id: 'a1',
		questions: [new AttemptQuestion('essay', QuestionType.Writing, [], 9)],
		responses: [new AttemptResponseResult('r1', 'essay', ['essay'], null, 7)],
	});

const payload = (): WritingScoredEvent =>
	Object.assign(new WritingScoredEvent(), {
		status: 'success',
		attempt_id: 'a1',
		response_id: 'r1',
		data: {
			overall_score: 7,
			sub_scores: {},
			detailed_feedback: 'ok',
			corrected_version: 'ok',
		},
	});

const setup = () => {
	const repo = {
		saveComment: jest.fn().mockResolvedValue('a1'),
		getScoreEvaluator: jest.fn().mockImplementation(() => Promise.resolve(evaluator())),
		save: jest.fn<Promise<void>, [AttemptEvaluator]>().mockResolvedValue(undefined),
	};
	return { repo: repo, handler: new WritingScoredHandler(repo as never) };
};

describe('WritingScoredHandler (C9)', () => {
	it('saves the feedback, then saves a score that includes the writing points', async () => {
		const { repo, handler } = setup();
		await handler.handle(payload());
		expect(repo.saveComment).toHaveBeenCalledWith('r1', JSON.stringify(payload().data));
		expect(repo.getScoreEvaluator).toHaveBeenCalledWith('a1');
		const [saved] = repo.save.mock.calls[0];
		expect(saved.score).toBe(7);
		expect(saved.totalPoints).toBe(9);
		expect(saved.getUncommittedEvents()).toHaveLength(0);
	});

	it('re-runs on a version conflict (two writings of one attempt scored at once)', async () => {
		const { repo, handler } = setup();
		repo.save.mockRejectedValueOnce(new AttemptVersionConflictException());
		await handler.handle(payload());
		expect(repo.saveComment).toHaveBeenCalledTimes(2);
		expect(repo.save).toHaveBeenCalledTimes(2);
	});

	it('fails the message on a scoring error without saving anything', async () => {
		const { repo, handler } = setup();
		await expect(
			handler.handle(Object.assign(payload(), { status: 'error', error_message: 'boom' })),
		).rejects.toThrow('boom');
		expect(repo.saveComment).not.toHaveBeenCalled();
	});
});
