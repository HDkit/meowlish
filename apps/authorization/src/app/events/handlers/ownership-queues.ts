/** Queue names of the ownership consumers; also their inbox consumer names. */
export const OWNERSHIP_QUEUES = {
	examCreated: 'authorization.events.exam.created',
	examDeleted: 'authorization.events.exam.deleted',
	roomCreated: 'authorization.events.room.created',
	roomDeleted: 'authorization.events.room.deleted',
	resourceCreated: 'authorization.events.resource.created',
	resourceDeleted: 'authorization.events.resource.deleted',
} as const;
