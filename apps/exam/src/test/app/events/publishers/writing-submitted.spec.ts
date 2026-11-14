import {
	WritingSubmittedPublisher,
	examMatchesGoalType,
} from '../../../../app/events/publishers/writing-submitted';
import { WritingSubmittedEvent } from '../../../../domain/events/writing-submitted';

const setup = (examTags: string[], goal: { type: string; target: number } | null) => {
	const attempts = {
		getWritingResponse: jest.fn().mockResolvedValue({
			attemptedBy: 'u1',
			examId: 'e1',
			examTags: examTags,
			questionContent: 'Describe the chart',
			questionTags: ['IELTS Writing T1-T2'],
			answer: ['My essay'],
		}),
	};
	const goals = {
		getGoal: jest.fn().mockResolvedValue(goal && { uid: 'u1', date: new Date(), ...goal }),
	};
	const outbox = { add: jest.fn().mockResolvedValue(undefined) };
	const publisher = new WritingSubmittedPublisher(
		attempts as never,
		goals as never,
		outbox as never,
	);
	const targetSent = async (): Promise<unknown> => {
		await publisher.publish([
			new WritingSubmittedEvent({
				attemptId: 'a1',
				responseId: 'r1',
				questionId: 'q1',
				responseContent: 'My essay',
			}),
		]);
		const [, message] = outbox.add.mock.calls[0] as [string, { target_score: unknown }];
		return message.target_score;
	};
	return { targetSent: targetSent };
};

describe('WritingSubmittedPublisher target_score', () => {
	it("sends the goal's target when the goal is for this exam's test", async () => {
		const { targetSent } = setup(['IELTS', 'IELTS Writing T1-T2'], { type: 'IELTS', target: 7 });
		await expect(targetSent()).resolves.toBe(7);
	});

	it('sends 0 for a goal of another test (a TOEIC 800 is no IELTS band)', async () => {
		const { targetSent } = setup(['IELTS Writing T1-T2'], { type: 'TOEIC', target: 800 });
		await expect(targetSent()).resolves.toBe(0);
	});

	it('sends 0 without a goal', async () => {
		const { targetSent } = setup(['IELTS'], null);
		await expect(targetSent()).resolves.toBe(0);
	});
});

describe('examMatchesGoalType', () => {
	it.each([
		[['IELTS'], 'IELTS', true],
		[['ielts writing t1-t2'], 'IELTS', true],
		[['TOEIC Reading', 'Grammar'], 'TOEIC', true],
		[['IELTSX'], 'IELTS', false],
		[['Grammar'], 'IELTS', false],
		[[], 'IELTS', false],
		[['IELTS'], '', false],
	])('%j / %s → %s', (tags, type, expected) => {
		expect(examMatchesGoalType(tags, type)).toBe(expected);
	});
});
