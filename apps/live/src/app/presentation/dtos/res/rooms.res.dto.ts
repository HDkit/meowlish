import { live } from '@server/generated';
import { Expose, Type } from 'class-transformer';

class RoomDto implements live.Rooms_Room {
	@Expose()
	id!: string;

	@Expose()
	name!: string;

	@Expose()
	scheduledDate?: Date;

	@Expose()
	scheduledLiveUrl?: string;
}

export class RoomsDto implements live.Rooms {
	@Expose()
	nextCursor!: string;

	@Expose()
	prevCursor!: string;

	@Expose()
	@Type(() => RoomDto)
	rooms!: RoomDto[];
}
