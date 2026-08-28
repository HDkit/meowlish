import { notification } from '@server/generated';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePreferencesReqDto implements notification.UpdatePreferencesRequest {
	@IsString()
	identityId!: string;

	@IsBoolean()
	@IsOptional()
	emailEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	pushEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	achievementEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	reportEnabled?: boolean;

	@IsBoolean()
	@IsOptional()
	systemEnabled?: boolean;
}
