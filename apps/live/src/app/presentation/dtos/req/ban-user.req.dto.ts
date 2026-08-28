import { live } from '@server/generated';
import { IsString } from 'class-validator';

export class BanUserDto implements live.BanUserFromRoomRequest {
	@IsString()
	reason!: string;

	@IsString()
	roomId!: string;

	@IsString()
	uid!: string;
}
