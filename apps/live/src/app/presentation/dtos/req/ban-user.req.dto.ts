import { live } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class BanUserDto implements live.BanUserFromRoomRequest {
	// optional in the proto and at the gateway: an omitted reason arrives as undefined
	@IsOptional()
	@IsString()
	reason?: string;

	@IsString()
	roomId!: string;

	@IsString()
	uid!: string;

	@IsString()
	requesterId!: string;

	@IsBoolean()
	privileged!: boolean;
}
