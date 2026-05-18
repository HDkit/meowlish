export interface IRoomRepository {
	updateRoomSchedule(
		roomId: string,
		options: { url?: string | null; time?: Date | null },
	): Promise<void>;
	canJoinRoom(roomId: string, uid: string): Promise<boolean>;
	createRoom(name: string): Promise<void>;
	removeRoom(roomId: string): Promise<void>;
	banUserFrom(roomId: string, uid: string, reason: string): Promise<void>;
	unbanUserFrom(roomId: string, uid: string): Promise<void>;
}

export const IRoomRepositoryToken = Symbol('IRoomRepository');
