import { live } from '@server/generated';
import { IsBoolean, IsString } from 'class-validator';

export class BanUserDto implements live.BanUserFromRoomRequest {
	@IsString()
	reason!: string;

	@IsString()
	roomId!: string;

	@IsString()
	uid!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
