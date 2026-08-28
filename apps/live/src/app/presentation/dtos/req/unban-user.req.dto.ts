import { live } from '@server/generated';
import { IsString } from 'class-validator';

export class UnbanUserDto implements live.UnbanUserFromRoomRequest {
	@IsString()
	roomId!: string;

	@IsString()
	uid!: string;
}
