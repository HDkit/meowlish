import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Loose on purpose: an existing username from before the charset rule (or Google's 36-character
 * UUID fallback) must still be accepted when re-sent unchanged. auth applies the rule
 * (USERNAME_PATTERN) only when the username actually changes.
 */
const LEGACY_USERNAME_MAX_LENGTH = 50;

export class UpdateIdentityDto {
	@IsOptional()
	@IsString()
	@MaxLength(LEGACY_USERNAME_MAX_LENGTH)
	@ApiPropertyOptional({
		maxLength: LEGACY_USERNAME_MAX_LENGTH,
		description:
			'Empty leaves the username unchanged; whitespace-only is refused. A new username must be 3-30 lowercase letters, digits, ".", "_" or "-" (400 otherwise); re-sending the current one is always accepted.',
	})
	@Matches(/^$|\S/, { message: 'username must not be blank' })
	username?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	fullName?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	bio?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	avatarId?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
	phoneNumber?: string;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setFullNameNull?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setBioNull?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setAvatarIdNull?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	setPhoneNumberNull?: boolean;
}
