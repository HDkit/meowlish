import { live } from '@server/generated';
import { Expose } from 'class-transformer';

export class CreatedRoomDto implements live.CreatedRoomResponse {
	@Expose()
	id!: string;
}
