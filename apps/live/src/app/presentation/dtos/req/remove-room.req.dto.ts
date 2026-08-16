import { live } from '@server/generated';
import { IsString } from 'class-validator';

export class RemoveRoomDto implements live.RemoveRoomRequest {
	@IsString()
	roomId!: string;
}
