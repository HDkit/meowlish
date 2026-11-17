/** A room's live-stream schedule as stored; null when not set. */
export type RoomSchedule = { scheduledLiveUrl: string | null; scheduledTime: Date | null };

export interface IRoomRepository {
	/** Sets or clears the schedule (undefined leaves a field alone) and returns it as saved. */
	updateRoomSchedule(
		roomId: string,
		options: { url?: string | null; time?: Date | null },
	): Promise<RoomSchedule>;
	canJoinRoom(roomId: string, uid: string): Promise<boolean>;
	/** Whether a `banneds` row exists for this user in this room. */
	isBannedFrom(roomId: string, uid: string): Promise<boolean>;
	createRoom(name: string, createdBy?: string): Promise<string>;
	/** Owner of a live room: undefined when the room does not exist, null when it has no recorded owner. */
	getRoomOwner(roomId: string): Promise<string | null | undefined>;
	removeRoom(roomId: string): Promise<void>;
	banUserFrom(roomId: string, uid: string, reason: string): Promise<void>;
	unbanUserFrom(roomId: string, uid: string): Promise<void>;
	saveLog(
		roomId: string,
		fromId: string,
		message: string,
	): Promise<{ id: string; createdAt: Date }>;
}

export const IRoomRepositoryToken = Symbol('IRoomRepository');
