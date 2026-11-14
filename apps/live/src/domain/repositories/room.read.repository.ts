import { Room } from '../read-model/room.read-model';

export interface IRoomReadRepository {
	getRoomList(options?: {
		id?: string;
		direction?: number;
		limit?: number;
		/** case-insensitive substring of the room name */
		name?: string;
	}): Promise<Room[]>;
}

export const IRoomReadRepositoryToken = Symbol('IRoomReadRepository');
