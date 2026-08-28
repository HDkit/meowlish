import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateIdentityDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional()
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
