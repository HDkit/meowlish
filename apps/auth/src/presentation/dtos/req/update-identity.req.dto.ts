import { auth } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateIdentityDto implements auth.UpdateIdentityDto {
	@IsString()
	identityId!: string;

	@IsOptional()
	@IsString()
	username?: string;

	@IsOptional()
	@IsString()
	fullName?: string;

	@IsOptional()
	@IsString()
	bio?: string;

	@IsOptional()
	@IsString()
	avatarId?: string;

	@IsOptional()
	@IsString()
	phoneNumber?: string;

	@IsBoolean()
	@IsOptional()
	setFullNameNull?: boolean;

	@IsBoolean()
	@IsOptional()
	setBioNull?: boolean;

	@IsBoolean()
	@IsOptional()
	setAvatarIdNull?: boolean;

	@IsBoolean()
	@IsOptional()
	setPhoneNumberNull?: boolean;
}
