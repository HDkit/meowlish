import { live } from '@server/generated';
import { IsBoolean, IsString } from 'class-validator';

export class UnbanUserDto implements live.UnbanUserFromRoomRequest {
	@IsString()
	roomId!: string;

	@IsString()
	uid!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
