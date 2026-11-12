import { ApiPropertyOptional } from '@nestjs/swagger';
import { notification } from '@server/generated';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesReqDto implements Omit<
	notification.UpdatePreferencesRequest,
	'identityId'
> {
	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	emailEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	pushEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	achievementEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	reportEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	@ApiPropertyOptional()
	systemEnabled?: boolean;
}
