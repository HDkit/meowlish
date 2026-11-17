import { type ChatLog } from './chat-log.read-model';

export type Room = {
	id: string;
	name: string;
	scheduledLiveUrl?: string;
	scheduledDate?: Date;
	/** Room owner; undefined for rooms created before owners were recorded (admin-only). */
	createdBy?: string;
	/** Newest message, for the room list preview. */
	lastMessage?: ChatLog;
};
