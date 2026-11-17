import { ScoringDelay } from '../../app/scoring-delay';
import { WritingSubmittedHandler } from '../../app/writing-submitted.handler';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

describe('WritingSubmittedHandler', () => {
	const publish = jest.fn<Promise<void>, [string, string, unknown]>();
	const wait = jest.fn<Promise<void>, []>();
	let handler: WritingSubmittedHandler;

	beforeEach(() => {
		publish.mockReset().mockResolvedValue(undefined);
		wait.mockReset().mockResolvedValue(undefined);
		handler = new WritingSubmittedHandler(
			{ publish: publish } as unknown as AmqpConnection,
			{ wait: wait } as unknown as ScoringDelay,
		);
	});

	it('waits, then publishes exam.writing.scored with the same ids', async () => {
		const order: string[] = [];
		wait.mockImplementation(() => {
			order.push('wait');
			return Promise.resolve();
		});
		publish.mockImplementation(() => {
			order.push('publish');
			return Promise.resolve();
		});

		await handler.handle({
			attempt_id: 'a1',
			response_id: 'r1',
			question: 'q',
			content: 'essay',
			exam_type: 'IELTS',
			task_type: 'Task 1',
			target_score: 6.5,
		});

		expect(order).toEqual(['wait', 'publish']);
		expect(publish).toHaveBeenCalledTimes(1);
		const [exchange, routingKey, body] = publish.mock.calls[0];
		expect(exchange).toBe('eventbus');
		expect(routingKey).toBe('exam.writing.scored');
		expect(body).toMatchObject({
			status: 'success',
			attempt_id: 'a1',
			response_id: 'r1',
			data: { corrected_version: 'essay', corrections: [] },
		});
	});

	it('rejects a malformed payload without publishing', async () => {
		await expect(handler.handle({ attempt_id: 1 })).rejects.toThrow();
		expect(publish).not.toHaveBeenCalled();
	});
});
