import { QuestionFileAdded, SectionFileAdded } from '../../../domain/events/exam-management.event';
import { FileAddedIntegrationEvent } from '../file-added.event';
import { Injectable } from '@nestjs/common';
import { OutboxPublisher } from '@server/messaging';
import { type Event } from '@server/utils';

/** Writes `exam.file.added` to the outbox; call it inside the transaction that saved the question/section. */
@Injectable()
export class FileAddedPublisher {
	constructor(private readonly outbox: OutboxPublisher) {}

	async publish(events: readonly Event<unknown>[]): Promise<void> {
		for (const event of events) {
			if (!(event instanceof QuestionFileAdded) && !(event instanceof SectionFileAdded)) continue;
			const message: FileAddedIntegrationEvent = {
				fileId: event.payload.fileId,
			};
			await this.outbox.add('exam.file.added', message);
		}
	}
}
