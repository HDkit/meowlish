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
				target_score: goal?.target ?? 0, // need to map from tag?
			};
			await this.outbox.add('exam.writing.submitted', message);
		}
	}
}
