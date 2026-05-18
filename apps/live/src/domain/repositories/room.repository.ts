export interface IRoomRepository {
	updateRoomSchedule(
		roomId: string,
		options: { url?: string | null; time?: Date | null },
	): Promise<void>;
	canJoinRoom(roomId: string, uid: string): Promise<boolean>;
	createRoom(name: string): Promise<string>;
	removeRoom(roomId: string): Promise<void>;
	banUserFrom(roomId: string, uid: string, reason: string): Promise<void>;
	unbanUserFrom(roomId: string, uid: string): Promise<void>;
	saveLog(roomId: string, fromId: string, message: string): Promise<{ id: string; createdAt: Date }>;
}

export const IRoomRepositoryToken = Symbol('IRoomRepository');
