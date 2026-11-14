import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Google sign-up generates at most 36 characters (a UUID fallback). */
const USERNAME_MAX_LENGTH = 50;

export class UpdateIdentityDto {
	@IsOptional()
	@IsString()
	@MaxLength(USERNAME_MAX_LENGTH)
	@ApiPropertyOptional({
		maxLength: USERNAME_MAX_LENGTH,
		description: 'Empty leaves the username unchanged; whitespace-only is refused.',
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
