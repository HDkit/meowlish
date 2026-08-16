import { Room } from '../read-model/room.read-model';

export interface IRoomReadRepository {
	getRoomList(options?: { id?: string; direction?: number; limit?: number }): Promise<Room[]>;
}

export const IRoomReadRepositoryToken = Symbol('IRoomReadRepository');
