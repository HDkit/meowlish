import { live } from '@server/generated';
import { IsString } from 'class-validator';

export class CreateRoomDto implements live.CreateRoomRequest {
	@IsString()
	name!: string;
}
