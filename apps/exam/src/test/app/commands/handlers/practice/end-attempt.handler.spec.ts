import { AnswerHandler } from '../../../../../app/commands/handlers/practice/answer.handler';
import { EndAttemptHandler } from '../../../../../app/commands/handlers/practice/end-attempt.handler';
import {
	AnswerCommand,
	AnswerCommandPayload,
} from '../../../../../app/commands/practice/exam.answer.command';
import {
	EndAttemptCommand,
	EndAttemptCommandPayload,
} from '../../../../../app/commands/practice/exam.end-attempt.command';
import { Attempt, AttemptResponse } from '../../../../../domain/entities/attempt.entity';
import { AttemptSubmittedEvent } from '../../../../../domain/events/attempt.event';
import { AttemptVersionConflictException } from '../../../../../domain/repositories/attempt.repository';
import { QuestionType } from '../../../../../enums/question-type.enum';
import { ConflictException } from '@nestjs/common';

jest.mock('@nestjs-cls/transactional', () => ({ Transactional: () => () => undefined }));

type Row = { version: number; endedAt: Date | null; responses: AttemptResponse[] };

/**
 * In-memory stand-in for the Prisma repository: every `findOne` hands out a fresh aggregate, and
 * `save` applies only if the row is still at the version that aggregate was loaded with, the way
 * `updateMany({ where: { id, version } })` does.
 */
class VersionedAttemptStore {
	public row: Row = {
		version: 0,
		endedAt: null,
		responses: [new AttemptResponse({ questionId: 'q1', answers: ['a'] })],
	};
	public saves = 0;

	public async findOne(id: string): Promise<Attempt> {
		await Promise.resolve();
		return new Attempt({
			id: id,
			version: this.row.version,
			attemptedBy: 'u1',
			examId: 'e1',
			startedAt: new Date(),
			endedAt: this.row.endedAt,
			durationLimit: 3600,
			questions: [
				{ id: 'q1', type: QuestionType.MultipleChoiceSingle },
				{ id: 'q2', type: QuestionType.MultipleChoiceSingle },
			],
			responses: this.row.responses.map(
				r => new AttemptResponse({ ...r, answers: [...r.answers] }),
			),
		});
	}

	public async save(attempt: Attempt): Promise<void> {
		await Promise.resolve();
		if (attempt.version !== this.row.version) throw new AttemptVersionConflictException();
		this.row = {
			version: this.row.version + 1,
			endedAt: attempt.endedAt,
			responses: attempt.responses,
		};
		this.saves++;
	}
}

const setup = () => {
	const store = new VersionedAttemptStore();
	const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
	const handler = new EndAttemptHandler(store as never, publisher as never);
	const submit = () => handler.execute(new EndAttemptCommand(new EndAttemptCommandPayload('a1')));
	const submittedEvents = () =>
		publisher.publish.mock.calls
			.flatMap(([events]: [unknown[]]) => events)
			.filter(e => e instanceof AttemptSubmittedEvent);
	return {
		store: store,
		publisher: publisher,
		submit: submit,
		submittedEvents: submittedEvents,
	};
};

describe('EndAttemptHandler idempotency (C4)', () => {
	it('a second submit of an ended attempt is a no-op: no save, one attempt.submitted', async () => {
		const { store, submit, submittedEvents } = setup();
		await submit();
		await submit();
		expect(store.saves).toBe(1);
		expect(submittedEvents()).toHaveLength(1);
	});

	it('two concurrent submits publish attempt.submitted once; the loser becomes a no-op', async () => {
		const { store, submit, submittedEvents } = setup();
		await expect(Promise.all([submit(), submit()])).resolves.toBeDefined();
		expect(store.saves).toBe(1);
		expect(submittedEvents()).toHaveLength(1);
		expect(store.row.endedAt).not.toBeNull();
	});

	it('an answer racing the submit cannot reopen the attempt', async () => {
		const { store, submit } = setup();
		const answerHandler = new AnswerHandler(store as never);
		const answer = answerHandler.execute(
			new AnswerCommand(new AnswerCommandPayload('a1', 'q1', 'b')),
		);
		const results = await Promise.allSettled([answer, submit()]);
		expect(store.row.endedAt).not.toBeNull();
		// whichever loads first, the answer either lands before the end or is refused with a 409
		if (results[0].status === 'rejected')
			expect(results[0].reason).toBeInstanceOf(ConflictException);
	});

	it('an answer after the submit is rejected', async () => {
		const { store, submit } = setup();
		await submit();
		const answerHandler = new AnswerHandler(store as never);
		await expect(
			answerHandler.execute(new AnswerCommand(new AnswerCommandPayload('a1', 'q1', 'b'))),
		).rejects.toBeInstanceOf(ConflictException);
		expect(store.saves).toBe(1);
	});

	it('two concurrent answers on different questions of one attempt both succeed', async () => {
		const { store } = setup();
		const answerHandler = new AnswerHandler(store as never);
		await Promise.all([
			answerHandler.execute(new AnswerCommand(new AnswerCommandPayload('a1', 'q1', 'b'))),
			answerHandler.execute(new AnswerCommand(new AnswerCommandPayload('a1', 'q2', 'c'))),
		]);
		expect(store.saves).toBe(2);
		const answers = Object.fromEntries(
			store.row.responses.map(r => [r.questionId, [...r.answers]]),
		);
		expect(answers).toEqual({ q1: ['b'], q2: ['c'] });
	});
});
