import { auth } from '@server/generated';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Loose on purpose: an existing username from before the charset rule must still be accepted when
 * re-sent unchanged. UpdateIdentityCommandHandler applies USERNAME_PATTERN only to a change.
 */
const LEGACY_USERNAME_MAX_LENGTH = 50;

export class UpdateIdentityDto implements auth.UpdateIdentityDto {
	@IsString()
	identityId!: string;

	@IsOptional()
	@IsString()
	@MaxLength(LEGACY_USERNAME_MAX_LENGTH)
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
