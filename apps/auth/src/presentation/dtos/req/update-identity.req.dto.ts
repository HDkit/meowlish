import { auth } from '@server/generated';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Google sign-up generates at most 36 characters (a UUID fallback). */
const USERNAME_MAX_LENGTH = 50;

export class UpdateIdentityDto implements auth.UpdateIdentityDto {
	@IsString()
	identityId!: string;

	@IsOptional()
	@IsString()
	@MaxLength(USERNAME_MAX_LENGTH)
	@Matches(/^$|\S/, { message: 'username must not be blank' })
	// empty leaves the username unchanged; whitespace-only is refused
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
