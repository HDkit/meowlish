import { WRITING_SUBMITTED_QUEUE } from '../configs/rmq.config';
import { generateScore, writingSubmittedSchema } from './score-generator';
import { ScoringDelay } from './scoring-delay';
import { AmqpConnection, RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WritingSubmittedHandler {
	constructor(
		private readonly amqpConnection: AmqpConnection,
		private readonly scoringDelay: ScoringDelay,
	) {}

	// The input is a bare event (no envelope), so there is no inbox claim: re-scoring just makes
	// exam re-save feedback for the same response. A throw is retried with backoff, then dead-lettered.
	@RabbitSubscribe({
		exchange: 'eventbus',
		routingKey: 'exam.writing.submitted',
		...WRITING_SUBMITTED_QUEUE.subscribe,
	})
	async handle(@RabbitPayload() payload: unknown): Promise<void> {
		const event = writingSubmittedSchema.parse(payload);
		// Waiting here keeps the message unacked; PREFETCH_COUNT bounds how many wait at once.
		await this.scoringDelay.wait();
		// Published straight to the broker: this service has no database, so no outbox.
		await this.amqpConnection.publish('eventbus', 'exam.writing.scored', generateScore(event));
	}
}
