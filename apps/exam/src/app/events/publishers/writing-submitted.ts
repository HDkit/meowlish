import { WritingSubmittedEvent } from '../../../domain/events/writing-submitted';
import {
	type IAttemptRepository,
	IAttemptRepositoryToken,
} from '../../../domain/repositories/attempt.repository';
import {
	type IGoalRepository,
	IGoalRepositoryToken,
} from '../../../domain/repositories/goal.repository';
import { WritingSubmittedIntegrationEvent } from '../writing-submitted.event';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/**
 * Whether the exam belongs to the goal's test (IELTS, TOEIC, …): one of its tags is the test's name
 * or starts with it ("IELTS", "IELTS Writing T1-T2").
 */
export function examMatchesGoalType(examTags: readonly string[], goalType: string): boolean {
	const type = goalType.trim().toUpperCase();
	if (!type) return false;
	return examTags.some(tag => {
		const name = tag.trim().toUpperCase();
		return name === type || name.startsWith(`${type} `);
	});
}

/** Writes `exam.writing.submitted` to the outbox; call it inside the transaction that saved the score. */
@Injectable()
export class WritingSubmittedPublisher {
	constructor(
		@Inject(IAttemptRepositoryToken) private readonly attemptRepository: IAttemptRepository,
		@Inject(IGoalRepositoryToken) private readonly goalRepository: IGoalRepository,
		private readonly outbox: OutboxPublisher,
	) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof WritingSubmittedEvent)) continue;
			//not exactly the flow that I'd come up with where we need to include goal and tags and stuff but it wasn't made by me -D
			const response = await this.attemptRepository.getWritingResponse(event.payload.responseId);
			if (!response) throw new NotFoundException('Could not find response');
			const goal = await this.goalRepository.getGoal(response.attemptedBy);

			const message: WritingSubmittedIntegrationEvent = {
				attempt_id: event.payload.attemptId,
				response_id: event.payload.responseId,
				question: response.questionContent,
				content: response.answer ? response.answer.toString() : '',
				exam_type: response.examTags.toString(),
				task_type: response.questionTags.toString(),
				// the scorer reads the target in the exam's own scale, so another exam's goal means none
				target_score: goal && examMatchesGoalType(response.examTags, goal.type) ? goal.target : 0,
			};
			// The external AI scorer consumes this and expects the bare payload, not the envelope.
			await this.outbox.add('exam.writing.submitted', message, { bare: true });
		}
	}
}
