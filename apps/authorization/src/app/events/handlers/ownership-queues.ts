import { defineConsumerQueue } from '@server/messaging';

/** The ownership consumer queues; each `name` is also the inbox consumer name. */
export const OWNERSHIP_QUEUES = {
	examCreated: defineConsumerQueue('authorization.events.exam.created'),
	examDeleted: defineConsumerQueue('authorization.events.exam.deleted'),
	roomCreated: defineConsumerQueue('authorization.events.room.created'),
	roomDeleted: defineConsumerQueue('authorization.events.room.deleted'),
	resourceCreated: defineConsumerQueue('authorization.events.resource.created'),
	resourceDeleted: defineConsumerQueue('authorization.events.resource.deleted'),
} as const;
